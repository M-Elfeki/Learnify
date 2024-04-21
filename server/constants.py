from typing import List
from pydantic import BaseModel
from llama_index.core import PromptTemplate
from llama_index.core.llms import ChatMessage, MessageRole

example_exercise =  [
    {
        "type": "fill-in-the-blank",
        "title": "Medication Management",
        "illustration": "Illustration of medication pills",
        "sentence": "One of the key aspects of managing type 2 diabetes is taking ________ regularly as prescribed by your healthcare provider.",
        "options": [
        "vitamins",
        "medication",
        "herbal supplements",
        "painkillers"
        ],
        "correct_option": "medication"
    },
    {
        "type": "fill-in-the-blank-illustration",
        "title": "Diet Control",
        "illustration": "Illustration of healthy food choices",
        "sentence": "A balanced diet rich in ________ and low in processed sugars can help in managing blood sugar levels.",
        "options": [
        "fats",
        "sugars",
        "carbohydrates",
        "vegetables"
        ],
        "correct_option": "vegetables"
    },
    {
        "type": "fill-in-the-blank-illustration",
        "title": "Physical Activity",
        "illustration": "Illustration of a person exercising",
        "sentence": "Regular ________ such as walking or swimming can improve insulin sensitivity and help control blood sugar.",
        "options": [
        "meditation",
        "sleeping",
        "exercise",
        "reading"
        ],
        "correct_option": "exercise"
    },
    {
        "type": "complete-the-sentence",
        "title": "Blood Sugar Monitoring",
        "illustration": "Illustration of a glucose meter",
        "sentence": "It is important to regularly check your blood sugar levels using a glucose meter to ________.",
        "inputLabel": "This helps you track how your body responds to different foods and activities.",
        "correct_option": "monitor your progress"
    },
    {
        "type": "complete-the-sentence",
        "title": "Stress Management",
        "illustration": "Illustration of a person relaxing",
        "sentence": "Managing stress through techniques like deep breathing and yoga can help in ________.",
        "inputLabel": "This can positively impact your blood sugar levels.",
        "correct_option": "improving overall health"
    },
    {
        "type": "complete-the-sentence",
        "title": "Consulting Healthcare Provider",
        "illustration": "Illustration of a doctor and patient",
        "sentence": "Regularly consulting your healthcare provider can ensure that your treatment plan is ________.",
        "inputLabel": "This helps in making necessary adjustments to manage your condition effectively.",
        "correct_option": "optimized for your needs"
    }
]

example_flashcards = [
        '<h3>Understanding Type 2 Diabetes</h3><ul><li><strong>What is Type 2 Diabetes?</strong>: Type 2 diabetes is a chronic condition that affects the way your body metabolizes sugar (glucose). It is characterized by insulin resistance and high blood sugar levels.</li><li><strong>Causes of Type 2 Diabetes</strong>: Risk factors for type 2 diabetes include obesity, sedentary lifestyle, genetics, and age. It is important to manage these risk factors to prevent or control diabetes.</li></ul>',
        '<h3>Healthy Eating for Diabetes Management</h3><ul><li><strong>Balanced Diet</strong>: A balanced diet for diabetes includes a variety of fruits, vegetables, whole grains, lean proteins, and healthy fats. Portion control and monitoring carbohydrate intake are key.</li><li><strong>Meal Planning</strong>: Plan meals that are low in added sugars, saturated fats, and sodium. Focus on fiber-rich foods to help regulate blood sugar levels and promote overall health.</li></ul>',
        '<h3>Physical Activity and Diabetes</h3><ul><li><strong>Benefits of Exercise</strong>: Regular physical activity can help improve insulin sensitivity, lower blood sugar levels, and manage weight. Aim for at least 150 minutes of moderate-intensity exercise per week.</li><li><strong>Exercise Tips</strong>: Choose activities you enjoy, such as walking, swimming, or cycling. Incorporate strength training exercises to build muscle and improve metabolism.</li></ul>',
        '<h3>Monitoring Blood Sugar Levels</h3><ul><li><strong>Importance of Monitoring</strong>: Regularly monitoring blood sugar levels helps track how your body responds to food, exercise, and medication. It allows for early detection of high or low blood sugar levels.</li><li><strong>Monitoring Techniques</strong>: Use a blood glucose meter to check blood sugar levels at home. Keep a log of your readings and discuss them with your healthcare provider to adjust your diabetes management plan.</li></ul>',
        "<h3>Medication Management for Diabetes</h3><ul><li><strong>Types of Diabetes Medications</strong>: There are various types of diabetes medications, including oral medications, insulin injections, and other injectable medications. Your healthcare provider will determine the most suitable treatment for you.</li><li><strong>Medication Adherence</strong>: It is important to take your diabetes medications as prescribed to maintain stable blood sugar levels. Follow your healthcare provider's instructions and report any side effects or concerns.</li></ul>",
        '<h3>Stress Management and Diabetes</h3><ul><li><strong>Impact of Stress</strong>: Stress can affect blood sugar levels and overall health. Managing stress through relaxation techniques, exercise, and social support is important for diabetes management.</li><li><strong>Stress-Relief Strategies</strong>: Practice mindfulness, deep breathing, yoga, or meditation to reduce stress levels. Engage in hobbies, spend time with loved ones, and prioritize self-care to improve overall well-being.</li></ul>',
        '<h3>Preventing Diabetes Complications</h3><ul><li><strong>Complications of Diabetes</strong>: Uncontrolled diabetes can lead to serious complications such as heart disease, nerve damage, kidney problems, and vision loss. Proper management is crucial to prevent these complications.</li><li><strong>Regular Health Check-ups</strong>: Schedule regular check-ups with your healthcare provider to monitor your diabetes control, blood pressure, cholesterol levels, and overall health. Early detection and treatment can help prevent complications.</li></ul>',
        '<h3>Community Support and Resources</h3><ul><li><strong>Importance of Support</strong>: Joining diabetes support groups or seeking support from family and friends can provide encouragement, motivation, and valuable information for managing diabetes. You are not alone in this journey.</li><li><strong>Utilizing Resources</strong>: Explore resources such as educational materials, online forums, and diabetes management apps to enhance your knowledge and skills in managing diabetes. Stay informed and empowered in your self-care efforts.</li></ul>'
] 

custom_chat_history = [
    ChatMessage(
        role=MessageRole.USER,
        content="Hello assistant, we are having a insightful discussion about type 2 diabetes.",
    ),
    ChatMessage(role=MessageRole.ASSISTANT, content="Okay, sounds good."),
]

condense_prompt = PromptTemplate(
    """\
        Given a conversation (between Human and Assistant) and a follow up message from Human, \
        rewrite the message to be a standalone question that captures all relevant context \
        from the conversation.

        <Chat History>
        {chat_history}

        <Follow Up Message>
        {question}

        <Standalone question>
    """
)

context_prompt = PromptTemplate(
    "You are a chatbot, able to have normal interactions."
    "Here are the relevant documents for the context:\n"
    "{context_str}"
    "\nInstruction: Use the previous chat history, or the context above, to interact and help the user."
)


class choices(BaseModel):
    choice1: str
    choice2: str
    choice3: str
    choice4: str

class FillInTheBlanksQuestions(BaseModel):
    title: str
    illustration_caption: str
    sentence: str
    choices: choices
    correct_answer: str

class CompleteTheSentenceExercise(BaseModel):
    title: str
    illustration_caption: str
    sentence: str
    hint: str
    correct_answer: str

class LearningModule(BaseModel):
    fill_in_the_blanks_questions_ls: List[FillInTheBlanksQuestions]
    complete_the_sentence_exercises_ls: List[CompleteTheSentenceExercise]

   
class FlashcardPoint(BaseModel):
    point_title: str
    point_content: str

class Flashcard(BaseModel):
    title: str
    first_point: FlashcardPoint
    second_point: FlashcardPoint

class FlashcardList(BaseModel):
    flashcards: List[Flashcard]