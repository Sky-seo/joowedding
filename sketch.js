// sketch.js
let uploadedImages = [];
let userName = '';
let fileInput, uploadButton, addMoreButton, doneButton, nameInputElement, backgroundImageElement;
let isHeroImageHidden = false;
let showNameInput = false;
let isLoading = false;
let loadingProgress = 0; // 0 ~ 100
let loadingStatusText = "";
let isCompleted = false;

const CONTROL_AREA_HEIGHT = 220;
const PREVIEW_MARGIN = 20;
const PREVIEW_TOP = 60;
const PREVIEW_MIN_HEIGHT = 220;

let previewBounds = { x: PREVIEW_MARGIN, y: PREVIEW_TOP, width: 0, height: PREVIEW_MIN_HEIGHT };
let previewScroll = 0;
let previewContentHeight = 0;
let previewMaxScroll = 0;

const ADD_BUTTON_WIDTH = 180;
const ADD_BUTTON_HEIGHT = 45;
let DONE_BUTTON_WIDTH = 0;

function setup() {
    DONE_BUTTON_WIDTH = windowWidth - 40;

    createCanvas(windowWidth, windowHeight);
    pixelDensity(1);
    
    fileInput = document.getElementById('fileInput');
    backgroundImageElement = document.getElementById('backgroundImage');
    if (backgroundImageElement) backgroundImageElement.style.display = 'block';
    fileInput.addEventListener('change', handleFileSelect);

    uploadButton = createButton('SHARE THE PHOTOS <br>사진 공유하기 📷');
    uploadButton.class('upload-btn');
    uploadButton.style('line-height', '1.3');
    uploadButton.position(width/2 - 150, height - height/4);
    uploadButton.mousePressed(() => {
        hideHeroBackground();
        fileInput.click();
    });

    addMoreButton = createButton(' ADD / 추가 +');
    addMoreButton.class('upload-btn');
    addMoreButton.style('background', 'rgba(255,255,255,0.5)');
    addMoreButton.style('font-size', '16px');
    addMoreButton.style('padding', '10px 20px');
    addMoreButton.style('width', `${ADD_BUTTON_WIDTH}px`);
    addMoreButton.style('height', `${ADD_BUTTON_HEIGHT}px`);
    addMoreButton.style('text-align', 'center');
    addMoreButton.position(width/2 - ADD_BUTTON_WIDTH/2, height - 60);
    addMoreButton.mousePressed(() => fileInput.click());
    addMoreButton.hide();

    nameInputElement = createInput('');
    nameInputElement.class('name-input');
    nameInputElement.attribute('placeholder', 'your name / 이름');
    nameInputElement.position(width/2 - 125, height - 120);
    nameInputElement.hide();

    doneButton = createButton('UPLOAD / <br> 전송 하기 📤');
    doneButton.class('done-btn');
    doneButton.style('width', `${DONE_BUTTON_WIDTH}px`);
    doneButton.style('text-align', 'center');
    doneButton.position(width/2 - DONE_BUTTON_WIDTH/2, height - 80);
    doneButton.mousePressed(startUpload); // 통신 호출
    doneButton.hide();
}

function draw() {
    if (isCompleted) {
        background(0);
        fill(255); noStroke(); textAlign(CENTER, CENTER);
        textSize(24); text('DONE / 업로드 완료 ✅', width/2, height/2 - 20);
        return;
    }

    if (!isHeroImageHidden && uploadedImages.length === 0) {
        background(0, 0); // transparent to show CSS hero image
    } else {
        background("#9cb8d4");
    }
    updatePreviewBounds();

    if (uploadedImages.length > 0) {
        drawPreviewContainer();
        uploadButton.hide();
        displayImages();

        if (!showNameInput && !isLoading) {
            showNameInput = true;
            nameInputElement.show();
            doneButton.show();
            addMoreButton.show();
        }

        if (showNameInput) positionControlElements();

        fill(255); noStroke(); textAlign(CENTER, CENTER);
        if (!isLoading) {
            const labelBaseY = previewBounds.y + previewBounds.height - 80;
            textSize(20); text(`${uploadedImages.length} FILES`, width/2, labelBaseY);
            textSize(18); text('TYPE YOUR NAME / 이름을 입력해주세요', width/2, labelBaseY + 110);
        }
    } else {
        uploadButton.show();
        addMoreButton.hide();
        if (showNameInput) {
            showNameInput = false; 
            nameInputElement.hide(); 
            doneButton.hide();
        }
        previewScroll = 0;
    }

    if (isLoading) drawLoadingProgress();
}

function drawLoadingProgress() {
    fill(0,0,0,180); noStroke(); rect(0,0,width,height);
    
    fill(255); textAlign(CENTER, CENTER);
    textSize(20); text('Uploading...', width/2, height/2 - 50);
    textSize(14); text(loadingStatusText, width/2, height/2 - 20);

    let barWidth = min(width*0.8, 300);
    let barHeight = 10;
    let barX = width/2 - barWidth/2;
    let barY = height/2 + 10;

    fill(255,100); rect(barX, barY, barWidth, barHeight, 5);
    fill(76,175,80); 
    let pw = map(loadingProgress, 0, 100, 0, barWidth);
    rect(barX, barY, pw, barHeight, 5);

    textSize(16); text(`${Math.round(loadingProgress)}%`, width/2, height/2 + 40);
}

// 파일 선택 → 미리보기 리스트 추가
function handleFileSelect(e) {
    hideHeroBackground();
    const files = e.target.files; 
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const imgTag = createImg(ev.target.result, '');
                imgTag.hide();
                uploadedImages.push({
                    type: 'image',
                    image: imgTag,
                    file: file,
                    name: file.name
                });
            };
            reader.readAsDataURL(file);
        } else {
            uploadedImages.push({
                type: 'file',
                image: null,
                file: file,
                name: file.name
            });
        }
    }
}

// 통신 모듈 호출 (uploadFilesChunked)
function startUpload() {
    userName = nameInputElement.value().trim();
    if (!userName) { 
        alert('이름을 입력해주세요!'); 
        return; 
    }
    if (uploadedImages.length === 0) return;

    nameInputElement.hide(); 
    doneButton.hide(); 
    addMoreButton.hide();
    isLoading = true;

    const files = uploadedImages.map(item => item.file);

    uploadFilesChunked(files, userName, {
        onStatus: (msg) => {
            loadingStatusText = msg;
        },
        onProgress: (percent) => {
            loadingProgress = percent;
        },
        onComplete: () => {
            isCompleted = true;
        },
        onError: (err) => {
            alert("업로드 중 오류 발생: " + err.message);
            isLoading = false;
            nameInputElement.show();
            doneButton.show();
            addMoreButton.show();
        }
    });
}

function displayImages() {
    const layout = getPreviewLayout();
    const { cols, cardW, cardH, startX, startY, gap, padding } = layout;
    const totalRows = Math.ceil(uploadedImages.length / cols);
    const contentHeight = totalRows > 0 ? padding * 2 + totalRows * cardH + (totalRows - 1) * gap : 0;
    previewContentHeight = contentHeight;
    previewMaxScroll = Math.max(0, contentHeight - previewBounds.height);
    previewScroll = constrain(previewScroll, 0, previewMaxScroll);
    
    push();
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(previewBounds.x, previewBounds.y, previewBounds.width, previewBounds.height);
    drawingContext.clip();
    translate(0, -previewScroll);

    for (let i = 0; i < uploadedImages.length; i++) {
        let col = i % cols;
        let row = floor(i / cols);
        let x = startX + col * (cardW + gap);
        let y = startY + row * (cardH + gap);

        fill(255, 35); noStroke();
        rect(x, y, cardW, cardH, 12);
        
        // 이미지 미리보기
        if (uploadedImages[i].type === 'image' && uploadedImages[i].image) {
            let img = uploadedImages[i].image;
            let sc = min((cardW-20)/img.width, (cardH-20)/img.height);
            imageMode(CENTER);
            image(img, x + cardW/2, y + cardH/2, img.width*sc, img.height*sc);
            imageMode(CORNER);
        } else {
            // 비디오/기타 파일 아이콘
            fill(255, 100); rect(x+10, y+10, cardW-20, cardH-20, 5);
            fill(50); textAlign(CENTER, CENTER); textSize(12); textStyle(BOLD);
            text(uploadedImages[i].file.type.toUpperCase().split('/')[0] || "FILE", x + cardW/2, y + cardH/2);
        }

        // 삭제 버튼 (X)
        fill(255, 255, 255); 
        circle(x + cardW - 20, y + 20, 22);
        fill(0); 
        textAlign(CENTER, CENTER); 
        textSize(13); 
        textStyle(BOLD); 
        text("X", x + cardW - 20, y + 22);
    }
    drawingContext.restore();
    pop();
    textStyle(NORMAL);
}

// preview 영역 안인지 체크
function isPointInsidePreview(px, py) {
    return px >= previewBounds.x && px <= previewBounds.x + previewBounds.width &&
           py >= previewBounds.y && py <= previewBounds.y + previewBounds.height;
}

// X 눌렀을 때 아이템 삭제
function handleDeleteAt(px, py) {
    if (isLoading || isCompleted) return true;
    if (!isPointInsidePreview(px, py)) return true;

    const layout = getPreviewLayout();
    const { cols, cardW, cardH, startX, startY, gap } = layout;

    for (let i = 0; i < uploadedImages.length; i++) {
        let col = i % cols;
        let row = floor(i / cols);
        let x = startX + col * (cardW + gap);
        let y = startY + row * (cardH + gap);

        // 화면 기준 X 버튼 좌표 (스크롤 보정)
        let dx = x + cardW - 20;
        let dy = (y - previewScroll) + 20;

        // 터치/마우스 오차 고려해서 반지름 넉넉히
        if (dist(px, py, dx, dy) < 30) {
            const deleted = uploadedImages.splice(i, 1)[0];
            if (deleted?.image) deleted.image.remove();

            if (uploadedImages.length === 0) {
                showNameInput = false;
                nameInputElement.hide();
                doneButton.hide();
                addMoreButton.hide();
                uploadButton.show();
                previewScroll = 0;
            }
            document.getElementById('fileInput').value = '';
            return false; // 삭제 처리 후 기본 동작 막기
        }
    }

    return true;
}

// 모바일 터치 시작 (삭제 처리) - 터치도 mouseX/mouseY 사용
function touchStarted() {
    return handleDeleteAt(mouseX, mouseY);
}

// 데스크탑 클릭도 동일 로직 사용
function mousePressed() {
    return handleDeleteAt(mouseX, mouseY);
}

// 모바일 터치 이동 스크롤
function touchMoved() {
    if (isLoading || isCompleted || uploadedImages.length === 0) return true;
    if (!isPointInsidePreview(mouseX, mouseY)) return true;

    // 터치 시에도 p5가 pmouseY/mouseY 갱신해 줌
    const scrollDelta = pmouseY - mouseY;
    previewScroll = constrain(previewScroll + scrollDelta, 0, previewMaxScroll);

    return false; // 브라우저 기본 스크롤 막기
}

// 마우스 휠 스크롤
function mouseWheel(event) {
    if (isLoading || isCompleted || uploadedImages.length === 0) return true;
    if (!isPointInsidePreview(mouseX, mouseY)) return true;

    previewScroll = constrain(previewScroll + event.deltaY, 0, previewMaxScroll);
    return false;
}

function hideHeroBackground() {
    if (!isHeroImageHidden) {
        isHeroImageHidden = true;
        if (backgroundImageElement) backgroundImageElement.style.display = 'none';
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    updatePreviewBounds();
    if (!isCompleted) {
        uploadButton.position(width/2 - 120, height/2 - 25);
        if (showNameInput) positionControlElements();
    }
}

function drawPreviewContainer() {
    fill(255, 70); noStroke();
    rect(previewBounds.x, previewBounds.y, previewBounds.width, previewBounds.height, 25);
    fill(255); textAlign(LEFT, CENTER); textSize(16);
    text('PREVIEW / 사진 미리보기', previewBounds.x + 5, previewBounds.y - 20);
}

function getPreviewLayout() {
    const padding = 20;
    const innerWidth = max(10, previewBounds.width - padding * 2);
    const cols = innerWidth < 260 ? 1 : 2;
    const gap = 15;
    const cardWidthTotal = innerWidth - (cols - 1) * gap;
    const cardW = cols > 0 ? cardWidthTotal / cols : innerWidth;
    const cardH = cardW * 0.75;
    return {
        cols,
        cardW,
        cardH,
        startX: previewBounds.x + padding,
        startY: previewBounds.y + padding,
        gap,
        padding
    };
}

function updatePreviewBounds() {
    const availableHeight = height - (CONTROL_AREA_HEIGHT + PREVIEW_TOP);
    const fallbackHeight = max(120, min(PREVIEW_MIN_HEIGHT, height - PREVIEW_TOP - 40));
    const boundedHeight = availableHeight > 0 ? availableHeight : fallbackHeight;
    previewBounds = {
        x: PREVIEW_MARGIN,
        y: PREVIEW_TOP,
        width: width - PREVIEW_MARGIN * 2,
        height: boundedHeight
    };
}

function positionControlElements() {
    const pageCenterX = width / 2;
    const previewCenterX = previewBounds.x + previewBounds.width / 2;
    const nameInputWidth = previewBounds.width - 50;

    const addButtonY = previewBounds.y + previewBounds.height - ADD_BUTTON_HEIGHT - 20;
    const inputY = previewBounds.y + previewBounds.height + 50;
    const doneY = inputY + 70;

    const inputMinX = PREVIEW_MARGIN;
    //const inputMaxX = width - PREVIEW_MARGIN - nameInputWidth;
    const buttonMinX = PREVIEW_MARGIN;
    const buttonMaxX = width - PREVIEW_MARGIN - DONE_BUTTON_WIDTH;

    const addMin = previewBounds.x + 15;
    const addMax = max(addMin, previewBounds.x + previewBounds.width - ADD_BUTTON_WIDTH - 15);

    const inputX = constrain(pageCenterX - nameInputWidth / 2, inputMinX, 0);
    const addMoreX = constrain(previewCenterX - ADD_BUTTON_WIDTH / 2, addMin, addMax);
    const doneX = constrain(pageCenterX - DONE_BUTTON_WIDTH / 2, buttonMinX, buttonMaxX);

    nameInputElement.position(inputX, inputY);
    nameInputElement.style('width', `${nameInputWidth}px`);
    addMoreButton.position(addMoreX, addButtonY);
    doneButton.position(doneX, doneY);
}
