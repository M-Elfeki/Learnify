import torch, os, json
from transformers import pipeline
from llama_index.llms.openai import OpenAI
from transformers import BitsAndBytesConfig
from llama_index.core import PromptTemplate
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.llms.huggingface import HuggingFaceLLM
from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.program.openai import OpenAIPydanticProgram
from llama_index.core.storage.chat_store import SimpleChatStore
from constants import condense_prompt, LearningModule, FlashcardList, context_prompt
from llama_index.core import ServiceContext, Document, VectorStoreIndex

torch.random.manual_seed(42)
oai_key = os.environ["OPENAI_API_KEY"]

def messages_to_prompt(messages):
  prompt = ""
  for message in messages:
    if message.role == 'user':
      prompt += f"[INST] {message.content} [/INST]"
    elif message.role == 'assistant':
      prompt += f"{message.content}</s>"
  return prompt

def get_local_llm(model_name="mistralai/Mistral-7B-Instruct-v0.2",embed_model_name="mixedbread-ai/mxbai-embed-large-v1", device="cuda:0"):
    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
    )

    llm = HuggingFaceLLM(
        model_name=model_name,
        tokenizer_name=model_name,
        query_wrapper_prompt=PromptTemplate("Provide short answer to the following chat {query_str}\n"),
        context_window=16384,
        max_new_tokens=256,
        model_kwargs={"quantization_config": quantization_config, 'low_cpu_mem_usage': True},
        generate_kwargs={"temperature": 0.05, "top_k": 5, "top_p": 0.95, "do_sample": True, "pad_token_id": 2, "repetition_penalty": 1.2},
        messages_to_prompt=messages_to_prompt,
        device_map=device,
    )
    service_context = ServiceContext.from_defaults(llm=llm, embed_model="local:"+embed_model_name)
    openai_llm = OpenAI(model="gpt-3.5-turbo-0125", api_key=oai_key)
    torch.cuda.empty_cache()
    return service_context, openai_llm

def build_index(doc_str, service_context): 
    documents = [Document(text=doc_str, extra_info={'title': 'Main Content'})]
    index = VectorStoreIndex.from_documents(documents, service_context=service_context, insert_batch_size=4)
    torch.cuda.empty_cache()
    return index

def chat_prompt(service_context, index, query, user_id, memory, reference_threshold=0.50):
    # chat_engine = index.as_chat_engine(chat_mode="condense_plus_context", llm=service_context.llm, response_mode='compact', streaming=True, memory=memory, condense_question_prompt=custom_prompt, on_stream_end_fn=None)

    chat_engine = index.as_chat_engine(chat_mode="condense_plus_context", llm=service_context.llm, response_mode='compact', streaming=True, memory=memory, context_prompt=context_prompt, condense_question_prompt=condense_prompt, verbose=False, on_stream_end_fn=None)
    response = chat_engine.stream_chat(query)

    references = []
    for cur_source in response.source_nodes:
        if cur_source.get_score() >= reference_threshold:
            response_json = json.loads(cur_source.json())
            references.append([cur_source.get_score(), 'MainFile', response_json['node']['text']])
    
    return response, references
        
def add_round_to_memory(memory, user_message, assistant_message):
    memory.put(ChatMessage(role=MessageRole.USER, content=user_message))
    memory.put(ChatMessage(role=MessageRole.ASSISTANT, content=assistant_message))
    return memory

def initialize_memory_from_file(chat_history_path, user_id):
    if os.path.exists(chat_history_path):
        with open(chat_history_path, 'r') as file:
            chat_store_string = json.load(file)
        chat_store = SimpleChatStore.parse_raw(chat_store_string)
        if user_id in list(json.loads(chat_store.to_json())['store'].keys()):
            return ChatMemoryBuffer.from_defaults(chat_store=chat_store, chat_store_key=user_id)

    return ChatMemoryBuffer.from_defaults(chat_store_key=user_id)

def create_learning_content(llm, flashcard_data, summary_data):
    prompt_template_str = f"Generate a learning exercise to teach students {summary_data}" + " using this information {{flashcard}} as a guiding topic for the exercise. The module must have 3 fill-in-the-blanks questions and 3 complete-the-sentence questions. Each question must have a title describing the question, illustration caption, sentence with a blank to fill, and the correct answer. For fill-in-the-blanks questions add four different choices where one of them must be the correct answer. For complete-the-sentence questions add a hint to the user."

    program = OpenAIPydanticProgram.from_defaults(
        output_cls=LearningModule, prompt_template_str=prompt_template_str, verbose=False, llm=llm,
    )

    output = program(
        flashcard=flashcard_data, description=f"Information to learn describing {summary_data}."
    )

    made_list = []
    for idx, cur_quest in enumerate(output.fill_in_the_blanks_questions_ls):
        type = 'fill-in-the-blank-illustration'
        if idx == 0:
            type = 'fill-in-the-blank'
        title = cur_quest.title
        illustration = cur_quest.illustration_caption
        sentence = cur_quest.sentence
        options = [cur_quest.choices.choice1, cur_quest.choices.choice2, cur_quest.choices.choice3, cur_quest.choices.choice4]
        correct_option = cur_quest.correct_answer
        made_list.append({'type': type, 'title': title, 'illustration': illustration, 'sentence': sentence, 'options': options, 'correct_option': correct_option})

    for cur_quest in output.complete_the_sentence_exercises_ls:
        type = 'complete-the-sentence'
        title = cur_quest.title
        illustration = cur_quest.illustration_caption
        sentence = cur_quest.sentence
        inputLabel = cur_quest.hint
        correct_option = cur_quest.correct_answer
        made_list.append({'type': type, 'title': title, 'illustration': illustration, 'sentence': sentence, 'inputLabel': inputLabel, 'correct_option': correct_option})

    return made_list


def create_flashcard_content(llm, guidebook_data, summary_data):
    prompt_template_str = f"Generate a list of five flashcards to teach students {summary_data}" + " using this guidebook {{guidebook}}. Each flashcard must have a title, and two points with a title and content for each point."

    program = OpenAIPydanticProgram.from_defaults(
        output_cls=FlashcardList, prompt_template_str=prompt_template_str, verbose=False, llm=llm,
    )

    output = program(
        guidebook=guidebook_data, description=f"Content to learn about {summary_data}."
    )

    made_list = []
    for cur_flashcard in output.flashcards:
        title = cur_flashcard.title
        first_point = cur_flashcard.first_point
        second_point = cur_flashcard.second_point
        
        cur_flashcard = "<h3>" + title + "</h3><ul><li><strong>" + first_point.point_title + "</strong>: " + first_point.point_content + "</li><li><strong>" + second_point.point_title + "</strong>: " + second_point.point_content + "</li></ul>"
        made_list.append(cur_flashcard)

    return made_list

def summarize_page(page, service_context):
    prompt = f"""
        [INST] Write a brief descriptive title for the following page: {page}\n. Output only the title and no other words. [/INST]
    """
    generation_model = service_context.llm
    generation_pipeline = pipeline('text-generation', model=generation_model._model, tokenizer=generation_model._tokenizer)
    reference_description = generation_pipeline(prompt, max_new_tokens=32, temperature=0.75)[0]['generated_text'].replace(prompt, '').strip()
    # remove any special characters from the generated text
    reference_description = ''.join(e for e in reference_description if e.isalnum() or e.isspace())
    return reference_description.strip()
