document.addEventListener('DOMContentLoaded', function() {

    const icon1 = document.querySelector('.icon1');
    const iconsLs = [document.querySelector('.icon1'), document.querySelector('.icon2'), document.querySelector('.icon3'), document.querySelector('.icon4'), document.querySelector('.icon5')];
    const chatBox = document.getElementById('chat-box');
    const referencesBox = document.getElementById('references-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const loading = document.getElementById('loading');
    const tutorialContainer = document.querySelector('.top-bar-tutorial');
    const iconContainer = document.querySelector('.icons-container');
    const exerciseContentContainer = document.querySelector('.exercise-content-container');
    const closeButton = document.querySelector('.close-button');
    const heartButton = document.querySelector('.heart-container');
    const heartCountSpan = document.querySelector('.heart-count');
    const progressBar = document.querySelector('.progress-bar');

    const actionsContainer = document.querySelector('.actions-container');
    let solutionContainer = document.querySelector('.solution-container');
    let wrongIllustration = document.querySelector('.illustration-wrong');
    let correctIllustration = document.querySelector('.illustration-correct');
    let solutionMessage = document.querySelector('.solution-message');
    let continueButton = document.querySelector('.continue-button');
    let skipButton = document.querySelector('.action-button.skip');

    let currentBotMessageElement = null;
    let lastChoice = null;
    let currentIcon = 1;

    let exampleExercise = {};
    var flashcardTexts = [];
    let currentSummary = '';

    window.onload = function() {
        userInput.focus();
        if (flashcardTexts.length === 0) {
            const currentMaterials = sessionStorage.getItem('message');
            currentSummary = sessionStorage.getItem('summary');
            if (currentMaterials)
                loadGuidingBook(currentMaterials);
        }
    };

    function loadGuidingBook(currentMaterials) {
        Promise.resolve(currentMaterials)
            .then(data => {
                return createFlashCards(data);
            })
            .then(() => {
                return createModule(flashcardTexts[currentIcon - 1]);
            })
            .catch(error => {
                console.error('There was a problem:', error);
            });
    }
    
    
    function createFlashCards(guidebookData) {
        return fetch('http://192.168.0.22:5000/create_flashcards', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ guidebook: guidebookData, summary: currentSummary })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data  => {
            flashcardTexts = data;
        })
        .catch(error => {
            console.error('Error generating flashcards:', error);
            throw error; 
        });
    }
    
    function createModule(flashcardData) {
        return fetch('http://192.168.0.22:5000/create_module', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ flashCard: flashcardData, summary: currentSummary })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data  => {
            exampleExercise = {
                total_count: data.length,
                current_count: 1,
                list: data
            };
        })
        .catch(error => {
            console.error('Error creating module:', error);
            throw error; 
        });
    }

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            sendBtn.click();
        }
    });

    icon1.addEventListener('click', () => {
        displayExercise(exampleExercise);
        tutorialContainer.style.display = 'none';
        iconContainer.style.display = 'none';
        exerciseContentContainer.style.display = 'block';
    });

    closeButton.addEventListener('click', () => {
        progressBar.style.width = '0%';
        alertWindow();
    });

    heartButton.addEventListener('click', () => {
        let heartCount = parseInt(heartCountSpan.textContent) || 0;
        heartCountSpan.textContent = heartCount + 1;
    });

    function displayExercise(exercise_ls) {
        insertExercise(exercise_ls);
        bindContinueButton(exercise_ls);
        bindSkipButton(exercise_ls);
    }

    function toggleSolutionActionsDisplay(showSolution) {
        if (showSolution) {
            solutionContainer.style.display = 'block';
            actionsContainer.style.display = 'none';
        } else {
            solutionContainer.style.display = 'none';
            actionsContainer.style.display = 'flex'; // or 'block', depending on your styling
        }
        
    }

    function bindContinueButton(exercise_ls) {
        continueButton.addEventListener('click', async function continueExercise() {
            exercise_ls.current_count++;
            if (exercise_ls.current_count <= exercise_ls.total_count) {
                // Ensure exercise_ls is passed as an argument to create_img
                if (exercise_ls.list[exercise_ls.current_count - 1].type !== 'fill-in-the-blank') {
                    await create_img(exercise_ls); // Corrected to pass exercise_ls
                }
    
                toggleSolutionActionsDisplay(false);
                insertExercise(exercise_ls);
            } else {
                toggleSolutionActionsDisplay(false);
                continueButton.removeEventListener('click', continueExercise); // Cleanup
                finishExercises(exercise_ls);
            }
        });
    }
    
    // Similar correction should be made in the skipButton event handler:
    function bindSkipButton(exercise_ls) {
        skipButton.addEventListener('click', async function skipExercise() {
            exercise_ls.current_count++;
            if (exercise_ls.current_count <= exercise_ls.total_count) {
                if (exercise_ls.list[exercise_ls.current_count - 1].type !== 'fill-in-the-blank') {
                    await create_img(exercise_ls); // Corrected to pass exercise_ls
                }
    
                toggleSolutionActionsDisplay(false);
                insertExercise(exercise_ls);
            } else {
                toggleSolutionActionsDisplay(false);
                skipButton.removeEventListener('click', skipExercise); // Cleanup
                finishExercises(exercise_ls);
            }
        });
    }
    
    function create_img(exercise_ls) {
        return new Promise((resolve, reject) => {
            let correct_answer = exercise_ls.list[exercise_ls.current_count - 1].correct_option;
            fetch('http://192.168.0.22:5000/generate_image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: correct_answer })
            })
            .then(response => response.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = function() {
                    const base64data = reader.result;
                    // Ensure you are updating the correct exercise illustration with base64data
                    exercise_ls.list[exercise_ls.current_count - 1].illustration = base64data; // Corrected to -1
                    resolve();
                };
                reader.readAsDataURL(blob);
            })
            .catch(error => {
                console.error('Error generating image:', error);
                reject(error);
            });
        });
    }
    

    function insertExercise(exercise_ls) {
        const middleContainerExercise = document.querySelector('.middle-container-exercise');
        let exerciseHTML = '';
        let exercise = exercise_ls.list[exercise_ls.current_count - 1];
        middleContainerExercise.innerHTML = '';
    
        switch (exercise.type) {
            case 'fill-in-the-blank':
                exerciseHTML = `
                    <div class="exercise-container">
                        <div class="exercise-content">
                            <div class="exercise-title">${exercise.title}</div>
                            <p class="sentence">${exercise.sentence}</p>
                            <div class="options-container">
                                ${exercise.options.map(option => `<div class="option" style="width: 80%;">${option}</div>`).join('')}
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'fill-in-the-blank-illustration':
                exerciseHTML = `
                    <div class="exercise-container">
                        <div class="exercise-content">
                            <div class="exercise-title">${exercise.title}</div>
                            <div class="sentence-illustration">
                                <img src="${exercise.illustration}" alt="Illustration" class="illustration" style="width: 30%;">
                                <p class="sentence">${exercise.sentence}</p>
                            </div>
                            <div class="options-container">
                                ${exercise.options.map(option => `<button class="option">${option}</button>`).join('')}
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'complete-the-sentence':
                exerciseHTML = `
                    <div class="exercise-container">
                        <div class="exercise-content" style="width: 60%;">
                            <div class="exercise-title">${exercise.title}</div>
                            <div class="sentence-completion">
                                <div class="sentence-completion-content">
                                    <img src="${exercise.illustration}" alt="Illustration" class="illustration" style="width: 25%;">
                                    <div class="speech-bubble">
                                        <p>${exercise.sentence}</p>
                                    </div>
                                </div>
                                <div class="sentence-completion-input-container">
                                    <label for="sentence" class="input-label">${exercise.inputLabel}</label>
                                    <input type="text" id="sentence" name="sentence" class="input-field">
                                    <span class="input-question-mark">?</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                break;
        }
    
        middleContainerExercise.innerHTML = exerciseHTML;
        bindOptionEventListeners(exercise_ls);

        let exerciseNumber = exercise_ls.current_count;

        let totalExercises = parseFloat(exercise_ls.total_count);
        document.documentElement.style.setProperty('--progress-bar-width', exerciseNumber/totalExercises * 100 + '%');
    }

    function bindOptionEventListeners(exercise_ls) {
        const options = document.querySelectorAll('.option');
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                lastChoice = e.target.textContent;
                options.forEach(opt => opt.classList.remove('selected'));
                e.target.classList.add('selected');
            });
        });

        const checkButton = document.querySelector('.action-button.check');
        checkButton.addEventListener('click', () => {
            checkAnswer(exercise_ls);
        });
    }

    function checkAnswer(exercise_ls) {
        let exercise = exercise_ls.list[exercise_ls.current_count - 1];
        let correctOption = exercise.correct_option;

        if(exercise.type === 'complete-the-sentence') {
            lastChoice = document.querySelector('.input-field').value;
        }


        if (lastChoice !== null) {
            if (lastChoice === correctOption) {
                correctAnswerAction(exercise_ls);                
            } else {
                incorrectAnswerAction(exercise_ls);
            }
            toggleSolutionActionsDisplay(true);
        } else {
            alert('Please select an option');
        }
    }

    function correctAnswerAction(exercise_ls) {
        solutionContainer.classList.add('show', 'correct');
        wrongIllustration.style.display = 'none';
        correctIllustration.style.display = 'block';
        solutionMessage.textContent = 'Good Job';
        continueButton.textContent = 'CONTINUE';
        continueButton.classList.add('correct');
        document.querySelector('.actions-container').style.display = 'none';
    }

    function incorrectAnswerAction(exercise_ls) {
        correctOption = exercise_ls.list[exercise_ls.current_count - 1].correct_option;
        solutionContainer.classList.add('show');
        solutionContainer.classList.remove('correct');
        wrongIllustration.style.display = 'block';
        correctIllustration.style.display = 'none';
        solutionMessage.textContent = `Correct solution: ${correctOption}`;
        continueButton.textContent = 'CONTINUE';
        continueButton.classList.remove('correct');
        document.querySelector('.actions-container').style.display = 'none';
    }

    function finishExercises(exercise_ls) {
        tutorialContainer.style.display = 'flex';
        iconContainer.style.display = 'flex';
        exerciseContentContainer.style.display = 'none';
        
        // Reset exercise_ls--> Ideally, add a new exercise_ls
        exercise_ls.current_count = 1;

        iconsLs[currentIcon].style.backgroundColor = '#32CD32';
        iconsLs[currentIcon].style.cursor = 'pointer';
        if (currentIcon <= flashcardTexts.length && exercise_ls.current_count === exercise_ls.total_count) {
            createModule(flashcardTexts[currentIcon]);
        }
        currentIcon ++;

        iconsLs[currentIcon - 1].addEventListener('click', () => {
            displayExercise(exampleExercise);
            tutorialContainer.style.display = 'none';
            iconContainer.style.display = 'none';
            exerciseContentContainer.style.display = 'block';
        });
    }

    const guidebookBtn = document.querySelector('.guidebook');
    guidebookBtn.addEventListener('click', function() {
        const currentMaterials = sessionStorage.getItem('message');
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        
        const overlayContent = document.createElement('div');
        overlayContent.className = 'overlay-content';
        
        const closeBtn = document.createElement('span');
        closeBtn.innerHTML = '&times;';
        closeBtn.className = 'close-btn';
        
        closeBtn.onclick = function() {
            document.body.removeChild(overlay);
        };
        
        const contentParagraph = document.createElement('p');
        contentParagraph.className = 'guidebook-content';
        const iframe = document.createElement('iframe');
        iframe.srcdoc = currentMaterials; 
        iframe.style.width = '800px';
        iframe.style.height = '600px';
        iframe.style.border = 'none';
        overlayContent.appendChild(iframe);
        
        overlayContent.appendChild(closeBtn);
        overlayContent.appendChild(contentParagraph);
        overlay.appendChild(overlayContent);
        
        document.body.appendChild(overlay);
    });
    

    function alertWindow() {
        const overlay = document.createElement('div');
        overlay.className = 'alert-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '1000';
    
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert-container';
        alertDiv.style.background = 'white';
        alertDiv.style.padding = '20px';
        alertDiv.style.borderRadius = '10px';
        alertDiv.style.textAlign = 'center';
        alertDiv.style.maxWidth = '400px';
        alertDiv.style.width = '90%';
    
        const alertMessage = document.createElement('p');
        alertMessage.className = 'alert-message';
        alertMessage.textContent = "Wait, don't go! You'll lose your progress if you quit now";
        alertMessage.style.marginBottom = '20px';
    
        const cryingImage = document.createElement('img');
        cryingImage.src = './assets/icons/crying.png';
        cryingImage.alt = 'Crying';
        cryingImage.style.width = '30%';
        cryingImage.style.height = 'auto';
        cryingImage.style.marginBottom = '20px';
    
        const keepLearningButton = document.createElement('button');
        keepLearningButton.className = 'alert-button keep-learning';
        keepLearningButton.textContent = 'KEEP LEARNING';
        keepLearningButton.style.backgroundColor = '#4CAF50'; 
        keepLearningButton.style.color = 'white';
        keepLearningButton.style.border = 'none';
        keepLearningButton.style.borderRadius = '4px';
        keepLearningButton.style.padding = '15px 32px';
        keepLearningButton.style.textAlign = 'center';
        keepLearningButton.style.textDecoration = 'none';
        keepLearningButton.style.display = 'inline-block';
        keepLearningButton.style.fontSize = '16px';
        keepLearningButton.style.margin = '4px 2px';
        keepLearningButton.style.cursor = 'pointer';
        keepLearningButton.style.width = '80%';
    
        const endSessionButton = document.createElement('button');
        endSessionButton.className = 'alert-button end-session';
        endSessionButton.textContent = 'END SESSION';
        endSessionButton.style.backgroundColor = '#008CBA';
        endSessionButton.style.color = 'white';
        endSessionButton.style.border = 'none';
        endSessionButton.style.borderRadius = '4px';
        endSessionButton.style.padding = '15px 32px';
        endSessionButton.style.textAlign = 'center';
        endSessionButton.style.textDecoration = 'none';
        endSessionButton.style.display = 'inline-block';
        endSessionButton.style.fontSize = '16px';
        endSessionButton.style.margin = '4px 2px';
        endSessionButton.style.cursor = 'pointer';
        endSessionButton.style.width = '80%';
    
        keepLearningButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
            progressBar.style.width = '100%';
        });
    
        endSessionButton.addEventListener('click', () => {
            window.location.href = 'learnify.html';
        });
    
        alertDiv.appendChild(cryingImage);
        alertDiv.appendChild(alertMessage);
        alertDiv.appendChild(keepLearningButton);
        alertDiv.appendChild(endSessionButton);
        overlay.appendChild(alertDiv);
        document.body.appendChild(overlay);
    }

    function sendMessage() {
        const message = userInput.value.trim();
        if (message === '') return;

        appendMessage('user', message);
        userInput.value = '';
        currentBotMessageElement = null; // Reset the bot message element for the next message
        referencesBox.innerHTML = ''; // Clear previous references

        showLoading(); // Show loading progress
        sendBtn.disabled = true; // Disable send button
        
        fetchResponse(message)
            .then(() => {
                hideLoading(); // Hide loading progress
                sendBtn.disabled = false; // Enable send button after response is fetched
            })
            .catch(error => {
                console.error('Error:', error);
                hideLoading(); // Hide loading progress on error
                sendBtn.disabled = false; // Enable send button on error
            });
    }

    function showLoading() {
        loading.style.display = 'block';
    }

    function hideLoading() {
        loading.style.display = 'none';
    }

    function appendMessage(sender, message, continuous = false) {
        if (continuous && currentBotMessageElement) {
            currentBotMessageElement.textContent += message;
        } else {
            const messageElement = document.createElement('div');
            messageElement.classList.add(sender === 'user' ? 'user-message' : 'bot-message');
            messageElement.textContent = message;
            chatBox.appendChild(messageElement);

            if (sender === 'bot') {
                currentBotMessageElement = messageElement;
            }

            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }

    function fetchResponse(message) {
        return fetch('http://192.168.0.22:5000/answer_prompt', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userID: 'user1', prompt: message})
        })
        .then(response => {
            if (response.body) {
                streamResponse(response, chatBox, referencesBox);
            } else {
                console.error('No response body');
            }
        })
        .catch(console.error);
    }

    function processAndDisplayReferences(allReferencesString, referencesDisplayElement) {
        const referencesArray = allReferencesString.split(/\[\d+\]/).filter(Boolean);
    
        referencesDisplayElement.innerHTML = '';
    
        referencesArray.forEach((ref, index) => {
            const details = ref.split('||').map(detail => detail.trim());
            const score = parseFloat(details[0]);
            const fileName = './assets/references/' + details[2].replace(/\.txt$/, '.html');
            const text = details.slice(3).join('||').replace('<br/>', '');
    
            const referenceHtml = document.createElement('div');
            const anchor = document.createElement('a');
            anchor.href = "javascript:void(0);"; // Prevent the anchor from navigating to a new page
            anchor.textContent = text;
            anchor.addEventListener('click', function() {
                showOverlay(fileName, text);
            });
            
            referenceHtml.innerHTML = `[${index + 1}] `;
            referenceHtml.appendChild(anchor);
            referencesDisplayElement.appendChild(referenceHtml);
        });
    }

    function showOverlay(url, retrievedString) {
        const encodedString = encodeURIComponent(retrievedString);
        const currentMaterials = sessionStorage.getItem('message');
    
        // Create overlay div
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
        overlay.style.color = '#fff';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
    
        // Create iframe to display HTML file
        const iframe = document.createElement('iframe');
        iframe.srcdoc = currentMaterials;
        iframe.style.width = '80%';
        iframe.style.height = '80%';
        iframe.style.borderRadius = '10px';
        iframe.style.border = 'none';
        iframe.style.backgroundColor = '#FFF';
    
        // Create close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '20px';
        closeButton.style.right = '20px';
        closeButton.style.padding = '10px 15px';
        closeButton.style.backgroundColor = '#007BFF';
        closeButton.style.color = '#FFF';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '5px';
        closeButton.style.fontSize = '16px';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = function() {
            document.body.removeChild(overlay);
        };
    
        // Append elements to overlay
        overlay.appendChild(iframe);
        overlay.appendChild(closeButton);
        
        // Append overlay to body
        document.body.appendChild(overlay);
    
        // Once the iframe is loaded, highlight the closest matching string
        iframe.onload = function() {
            highlightClosestMatch(iframe, retrievedString);
        };
    }
    
    function highlightClosestMatch(iframe, searchString) {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    
        let closestMatch = null;
        let minimumLengthDifference = Infinity;
    
        // Function to recursively search text and find the closest match
        const textNodesUnder = (node) => {
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
            let textNode;
            while (textNode = walker.nextNode()) {
                const index = textNode.textContent.toLowerCase().indexOf(searchString.toLowerCase());
                if (index > -1) {
                    const lengthDifference = Math.abs(textNode.textContent.length - searchString.length);
                    if (lengthDifference < minimumLengthDifference) {
                        minimumLengthDifference = lengthDifference;
                        closestMatch = textNode.splitText(index);
                        closestMatch = closestMatch.splitText(searchString.length);
                    }
                }
            }
        };
    
        textNodesUnder(iframeDoc.body);
    
        // Highlight the closest match
        if (closestMatch) {
            const highlightSpan = document.createElement('span');
            highlightSpan.style.backgroundColor = 'yellow';
            highlightSpan.textContent = closestMatch.textContent;
            closestMatch.parentNode.replaceChild(highlightSpan, closestMatch);
            highlightSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    

    

    function streamResponse(response, chatDisplayElement, referencesDisplayElement) {
        const reader = response.body.getReader();
        let pastReferences = false;
        let curReferences = ''

        function read() {
            reader.read().then(({done, value}) => {
                if (done) {
                    currentBotMessageElement = null;
                    return;
                }
                const chunk = new TextDecoder("utf-8").decode(value);
                if (!pastReferences) {
                    if (chunk.includes("---end-of-references---")) {
                        pastReferences = true;
                        const parts = chunk.split("---end-of-references---");
                        const references = parts[0].split("...").join("...<br/>");
                        curReferences += references;
                        processAndDisplayReferences(curReferences, referencesDisplayElement);
                        appendMessage('bot', parts[1], true);
                    } else {
                        curReferences += chunk;
                    }
                } else {
                    appendMessage('bot', chunk, true); 
                }
                read();
            });
        }
        read();
    }


    const showFlashcardsBtn = document.getElementById('showFlashcardsBtn');
    showFlashcardsBtn.addEventListener('click', showFlashcardsOverlay);

    function showFlashcardsOverlay() {
        // Overlay
        const overlay = document.createElement('div');
        overlay.id = 'flashcardsOverlay';
        overlay.className = 'overlay';
        
        // Flashcards Container
        const flashcardsContainer = document.createElement('div');
        flashcardsContainer.className = 'flashcards-container';
                 
        
        // Create Flashcards
        flashcardTexts.forEach((text, index) => {
            const flashcard = document.createElement('div');
            flashcard.className = 'flashcard';
            if (index === 0) { flashcard.classList.add('active'); } // First card active
            flashcard.innerHTML = `<p>${text}</p>`;
            flashcardsContainer.appendChild(flashcard);
        });
        
        // Navigation Buttons
        const prevBtn = createButton('prevBtnFlashCards', 'nav-btn', '<', () => changeFlashcard(-1));
        const nextBtn = createButton('nextBtnFlashCards', 'nav-btn', '>', () => changeFlashcard(1));
        const closeBtn = createButton('closeBtnFlashCards', 'close-btn-flashcards', 'X', () => overlay.remove());
        
        // Append Buttons
        flashcardsContainer.appendChild(prevBtn);
        flashcardsContainer.appendChild(nextBtn);
        flashcardsContainer.appendChild(closeBtn);
        overlay.appendChild(flashcardsContainer);
        
        // Append Overlay to Body
        document.body.appendChild(overlay);
        
        let currentFlashcardIndex = 0; // Current flashcard index
        updateButtons(); // Initial button state
        
        // Change Flashcard
        function changeFlashcard(direction) {
            const flashcards = document.querySelectorAll('.flashcard');
            flashcards[currentFlashcardIndex].classList.remove('active'); // Hide current
            currentFlashcardIndex += direction; // Update index
            flashcards[currentFlashcardIndex].classList.add('active'); // Show new
            updateButtons();
        }
        
        // Update Button States
        function updateButtons() {
            const flashcards = document.querySelectorAll('.flashcard');
            prevBtn.disabled = currentFlashcardIndex === 0;
            nextBtn.disabled = currentFlashcardIndex === flashcards.length - 1;
        }
        
        // Create Button Helper
        function createButton(id, className, text, onclickFunction) {
            const button = document.createElement('button');
            button.id = id;
            button.className = className;
            button.textContent = text;
            button.onclick = onclickFunction;
            return button;
        }
    }

    
    

});



