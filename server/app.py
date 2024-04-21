from flask import Flask, send_file, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import warnings, io

from bs4 import BeautifulSoup
import pdfplumber
import requests

import torch
from diffusers import DiffusionPipeline
from constants import example_exercise, example_flashcards
from utils import get_local_llm, build_index, chat_prompt, add_round_to_memory, initialize_memory_from_file, create_flashcard_content, create_learning_content, summarize_page

warnings.filterwarnings("ignore")
app = Flask(__name__)
CORS(app)

DEBUG = False
service_context, index, pipe, chat_history_path, openai_llm, created_flashcards = None, None, None, None, None, None


def inference_step(user_id, prompt):
    memory = initialize_memory_from_file(chat_history_path, user_id)
    response, references = chat_prompt(service_context, index, prompt, user_id, memory)

    if references:
        ref_string = ''
        for idx, cur_ref in enumerate(references):
            cur_score, cur_file, cur_text = cur_ref
            ref_string += f'[{idx+1}] || {cur_score} || {cur_file} || {cur_text[:150]}...\n'
        yield ref_string
    yield "---end-of-references---" 

    cur_response = ''
    for token in response.response_gen:
        if '</s>' in token or '<|end_of_turn|>' in token:
            token = token.replace('</s>', '').replace('<|end_of_turn|>', '')
            cur_response += token
            yield token
            break
        if '<|' in token or '}' in token:
            break
        
        cur_response += token + ' '
        yield token
    memory = add_round_to_memory(memory, prompt, cur_response)
    torch.cuda.empty_cache()   

def image_inference_step(prompt, negative="worst quality, low quality, illustration, low resolution"):
    image = pipe(prompt, negative_prompt=negative, num_inference_steps=2, guidance_scale=0.0).images[0]
    torch.cuda.empty_cache()
    return image.resize((128, 128))

@app.route('/answer_prompt', methods=['POST'])
def answer_prompt():
    torch.cuda.empty_cache()
    data = request.get_json()
    user_id = data.get('userID', None)
    prompt = data.get('prompt', '')
    print(prompt)
    if not prompt or not user_id:
        return jsonify({"error": "prompt and user_id are required for RAG"}), 400
    return Response(stream_with_context(inference_step(user_id, prompt)), content_type='text/plain')

@app.route('/generate_image', methods=['GET', 'POST'])
def generate_image():
    prompt = request.json.get('message', 'A cute anime of a man')
    dummy_image = image_inference_step(prompt)

    img_byte_array = io.BytesIO()
    dummy_image.save(img_byte_array, format='PNG')
    img_byte_array.seek(0)

    return send_file(img_byte_array, mimetype='image/png')

@app.route('/create_module', methods=['POST'])
def create_module():
    global created_flashcards
    if not created_flashcards:
        created_flashcards = True
    else:
        print('Passing Modules')
        pass
    torch.cuda.empty_cache()
    data = request.get_json()
    flashcard_data = data.get('flashCard', '')
    summary_data = data.get('summary', '')
    if not flashcard_data:
        return jsonify({"error": "FlashCard is required to create content"}), 400
    if DEBUG:
        made_list = example_exercise
    else:
        made_list = create_learning_content(openai_llm, flashcard_data, summary_data)
    return jsonify(made_list)

@app.route('/create_flashcards', methods=['POST'])
def create_flashcards():
    global index
    if index:
        print('Passing flashcards')
        pass
    torch.cuda.empty_cache()
    data = request.get_json()
    guidebook_data = data.get('guidebook', '')
    summary_data = data.get('summary', '')
    index = build_index(guidebook_data, service_context)
    if not guidebook_data:
        return jsonify({"error": "Guidebook is required to create flashcards"}), 400
    
    if DEBUG:
        made_list = example_flashcards
    else:
        made_list = create_flashcard_content(openai_llm, guidebook_data, summary_data)
    return jsonify(made_list)

def convert_to_html(text):
    html_content = ""
    paragraphs = text.split("\n")
    for paragraph in paragraphs:
        if paragraph.startswith("Title:"):
            title = paragraph.replace("Title:", "").strip()
            html_content += f"<h2>{title}</h2>"
        else:
            html_content += f"<p>{paragraph}</p>"

    html_page = f"""<!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Converted HTML Page</title>
                    </head>
                    <body>
                        {html_content}
                    </body>
                    </html>"""

    return html_page

def extract_text_items(soup):
    html_text = ""
    for element in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p']):
        tag_name = element.name
        text = element.get_text().strip()
        text_items = f"<{tag_name}>{text}</{tag_name}>\n"
        html_text += text_items
    return html_text

@app.route('/process', methods=['POST'])
def process_url():
    data = request.get_json()
    url = data.get('url')
    try:
        response = requests.get(url)
        soup = BeautifulSoup(response.content, 'html.parser')
        html_text = extract_text_items(soup)
        summary = summarize_page(soup.get_text(), service_context)
        print(summary)
        return jsonify({'text': html_text, 'summary': summary})
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/upload', methods=['POST'])
def upload_pdf():
    pdf_file = request.files['pdf']
    try:
        with pdfplumber.open(pdf_file) as pdf:
            pages = [page.extract_text() for page in pdf.pages]
            text = ' '.join(filter(None, pages))
        html_text = convert_to_html(text)
        summary = summarize_page(text, service_context)
        return jsonify({'text': html_text, 'summary': summary})
    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == '__main__':
    created_flashcards = False
    chat_history_path = './assets/chat/chat_store.json'
    service_context, openai_llm = get_local_llm()
    pipe = DiffusionPipeline.from_pretrained("stabilityai/sdxl-turbo", torch_dtype=torch.float16, variant="fp16", device_map='auto', low_cpu_mem_usage=True)
    torch.cuda.empty_cache()
    app.run(host='192.168.0.22', port=5000)
