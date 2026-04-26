// Main application logic for Analog Horror Web UI

// UE Event Dispatcher Helper
function notifyUE(eventName, data = {}) {
    console.log(`[UE_EVENT] ${eventName}`, data);
    // If running in UE WebBrowser, window.ue might be available
    if (window.ue && window.ue.event) {
        // Assume UE implements standard event receiving
        try { window.ue.event(eventName, JSON.stringify(data)); } catch(e){}
    }
}

// Stage Management
function setStage(stageId) {
    document.querySelectorAll('.stage').forEach(el => el.classList.add('hidden'));
    const stageEl = document.getElementById(`stage-${stageId}`);
    if (stageEl) {
        stageEl.classList.remove('hidden');
    }

    // Initialize specific stage logic
    if (stageId === 'prologue') initPrologue();
    if (stageId === 'tutorial') initTutorial();
    if (stageId === 'pre2') initPre2();
    if (stageId === 'pre3') initPre3();
    if (stageId === 'pre4') initPre4();
    if (stageId === 'ending') initEnding();
}

// ---------------------------------------------
// Stage: Prologue
// ---------------------------------------------
function initPrologue() {
    setTimeout(() => {
        const popup = document.getElementById('prologue-popup');
        if(popup) popup.classList.remove('hidden');
    }, 2000);

    const btnAgree = document.getElementById('btn-agree');
    btnAgree.onclick = () => {
        document.body.classList.add('shake');
        
        // Wait a bit, then blackout
        setTimeout(() => {
            document.getElementById('blackout-overlay').style.opacity = '1';
            
            setTimeout(() => {
                document.body.classList.remove('shake');
                document.getElementById('prologue-popup').classList.add('hidden');
                notifyUE('Prologue_End');
            }, 2000);
            
        }, 1500);
    };
}

// ---------------------------------------------
// Stage: Tutorial (Scratch Canvas)
// ---------------------------------------------
function initTutorial() {
    const canvas = document.getElementById('scratch-pad');
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    
    // Set canvas dimensions
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

    // Fill with black marker
    ctx.fillStyle = '#111'; // Dark grey/black
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let isDrawing = false;
    let pixelsErased = 0;
    const targetErased = (canvas.width * canvas.height) * 0.4; // 40% cleared
    let cleared = false;

    function getCursorPosition(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left,
            y: (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top
        };
    }

    function scratch(e) {
        if (!isDrawing || cleared) return;
        e.preventDefault();
        
        const pos = getCursorPosition(e);
        
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2, false);
        ctx.fill();

        // Very basic clear check on interval to save CPU
        pixelsErased += 100; // rough estimate
        if (pixelsErased > targetErased && !cleared) {
            checkClear();
        }
    }

    function checkClear() {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let transparent = 0;
        for (let i = 3; i < imgData.data.length; i += 4) {
            if (imgData.data[i] === 0) transparent++;
        }
        
        if (transparent > (canvas.width * canvas.height * 0.5)) {
            cleared = true;
            canvas.style.transition = 'opacity 1s';
            canvas.style.opacity = '0';
            setTimeout(() => {
                canvas.style.display = 'none';
                notifyUE('Tutorial_Cleared');
            }, 1000);
        }
    }

    canvas.onmousedown = (e) => { isDrawing = true; scratch(e); };
    canvas.onmousemove = scratch;
    canvas.onmouseup = () => { isDrawing = false; };
    canvas.onmouseleave = () => { isDrawing = false; };
}

// ---------------------------------------------
// Stage: Pre2 (Radio Knob)
// ---------------------------------------------
function initPre2() {
    const knob = document.getElementById('radio-knob');
    const secretText = document.getElementById('pre2-secret');
    let isDragging = false;
    let startY = 0;
    let currentRotation = 0;
    
    // The target rotation to "tune in"
    const targetRotation = 145;
    let isCleared = false;

    function updateKnob(rotation) {
        // Clamp rotation 0-360
        rotation = (rotation % 360 + 360) % 360;
        currentRotation = rotation;
        knob.style.transform = `rotate(${currentRotation}deg)`;

        if(isCleared) return;

        // Calculate distance to target
        let dist = Math.abs(currentRotation - targetRotation);
        if (dist > 180) dist = 360 - dist;

        // Max noise at dist = 180, min noise at dist = 0
        const blurAmount = Math.max(0, (dist / 180) * 15);
        const opacityAmount = Math.max(0.1, 1 - (dist / 90));
        
        secretText.style.filter = `blur(${blurAmount}px) contrast(2) drop-shadow(0 0 5px red)`;
        secretText.style.opacity = opacityAmount;

        if (dist < 5) {
            // Cleared
            isCleared = true;
            secretText.style.filter = 'blur(0px) contrast(1)';
            secretText.style.opacity = '1';
            secretText.style.textShadow = '0 0 10px rgba(255,255,255,0.8)';
            notifyUE('Pre2_Cleared');
        }
    }

    knob.onmousedown = (e) => {
        if(isCleared) return;
        isDragging = true;
        startY = e.clientY;
    };
    
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaY = startY - e.clientY;
        startY = e.clientY;
        updateKnob(currentRotation + deltaY * 2);
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Reset state when initialized
    updateKnob(0);
    isCleared = false;
}

// ---------------------------------------------
// Stage: Pre3 (Spam Popups)
// ---------------------------------------------
function initPre3() {
    const TOTAL_POPUPS = 20;
    let popupsCleared = 0;
    let popupsActive = 0;

    const popupMessages = ["도망쳐", "움직이면 죽어", "뒤를 돌아보지 마", "살려줘", "들켰다", "444444", "눈을 감아"];

    const targetText = document.getElementById('pre3-secret');
    targetText.className = 'secret-text blurry-text'; // Reset

    // Remove old popups if re-initialized
    document.querySelectorAll('.popup').forEach(p => p.remove());

    const createPopup = () => {
        const popup = document.createElement('div');
        popup.className = 'popup';
        
        const width = 200 + Math.floor(Math.random() * 100);
        popup.style.width = `${width}px`;

        const maxWidth = window.innerWidth - width - 20;
        const maxHeight = window.innerHeight - 150;
        popup.style.left = `${Math.max(10, Math.floor(Math.random() * maxWidth))}px`;
        popup.style.top = `${Math.max(10, Math.floor(Math.random() * maxHeight))}px`;

        const isCreepyHeader = Math.random() > 0.7;
        const message = popupMessages[Math.floor(Math.random() * popupMessages.length)];
        
        popup.innerHTML = `
            <div class="popup-header ${isCreepyHeader ? 'creepy' : ''}">
                <span>경고</span>
                <div class="close-btn">X</div>
            </div>
            <div class="popup-body" style="color: ${Math.random() > 0.6 ? '#900' : '#000'}; font-size: ${14 + Math.floor(Math.random()*10)}px;">
                ${message}
            </div>
        `;

        popup.querySelector('.close-btn').addEventListener('click', () => {
            popup.remove();
            popupsCleared++;
            popupsActive--;
            
            if (popupsCleared >= TOTAL_POPUPS && popupsActive === 0) {
                targetText.classList.add('clear');
                notifyUE('Pre3_Cleared');
            }
        });

        document.getElementById('stage-pre3').appendChild(popup);
        popupsActive++;
    };

    setTimeout(() => {
        for (let i = 0; i < TOTAL_POPUPS; i++) {
            setTimeout(createPopup, i * 100 + Math.random() * 50);
        }
    }, 1000);
}

// ---------------------------------------------
// Stage: Pre4 (Login)
// ---------------------------------------------
window.showLoginHint = function() {
    // Called by Unreal Engine when player scans barcode
    document.getElementById('login-hint').classList.remove('hidden');
};

function initPre4() {
    const btn = document.getElementById('btn-login');
    const input = document.getElementById('admin-pw');
    const err = document.getElementById('login-error');

    input.value = '';
    err.classList.add('hidden');
    document.getElementById('login-hint').classList.add('hidden');

    btn.onclick = () => {
        if (input.value === '이지수') {
            notifyUE('Login_Success');
            setStage('ending');
        } else {
            err.classList.remove('hidden');
            input.value = '';
        }
    };
    
    input.onkeypress = (e) => {
        if(e.key === 'Enter') btn.click();
    }
}

// ---------------------------------------------
// Stage: Ending
// ---------------------------------------------
function initEnding() {
    // Apply a quick glitch effect to entire screen
    document.body.style.filter = 'hue-rotate(90deg) contrast(2) invert(1)';
    setTimeout(() => { document.body.style.filter = 'none'; }, 200);

    const popup = document.getElementById('ending-popup');
    const seq = document.getElementById('ending-sequence');
    const typingText = document.getElementById('typing-text');
    
    popup.classList.remove('hidden');
    seq.classList.add('hidden');
    typingText.innerHTML = '';

    document.getElementById('btn-exit').onclick = () => {
        popup.classList.add('hidden');
        seq.classList.remove('hidden');
        
        // Start typing
        const textToType = "수칙 5. 야간 자율학습 중 머리 위에서 낡은 선풍기가 흔들리는 소리가 난다면, 절대 위를 쳐다보지 마십시오. 이미 늦었습니다.";
        let i = 0;
        
        const typeInterval = setInterval(() => {
            typingText.innerHTML = textToType.substring(0, i);
            i++;
            if (i > textToType.length) {
                clearInterval(typeInterval);
                
                // Final blackout
                setTimeout(() => {
                    document.getElementById('blackout-overlay').style.opacity = '1';
                    notifyUE('Ending_Blackout');
                }, 1500);
            }
        }, 80); // Speed of typing
    };
}

// Ensure blackout is gone on load
document.addEventListener('DOMContentLoaded', () => {
    // Start at prologue by default, UE can change this.
    // Uncomment for standalone test: 
    // setStage('prologue');
});
