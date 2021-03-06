import face_status from "./face_status.js"
const video = document.getElementById('video')

Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('/models'),
]).then(startVideo)

function startVideo(){
    navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => video.srcObject = stream)
    .then(() => new Promise(resolve => video.onloadedmetadata = resolve))
  
}

const draw_rectangle = function(canvas,rec){
    //Draw rectangle for testing
    var ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.rect(rec.x, rec.y, rec.w, rec.h);
    ctx.stroke();
}

const draw_text = function(canvas,text,pos){
    //Draw rectangle for testing
    var ctx = canvas.getContext("2d");
    ctx.font = "30px Arial";
    ctx.fillText(text, pos.x, pos.y);
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRequest(request_actions,current_request) {
    // Note: will get random request_actions[0]
    let new_request = request_actions[getRandomInt(1,request_actions.length-1)];
    while (new_request==current_request){
        new_request = request_actions[getRandomInt(1,request_actions.length-1)];
    }
    return new_request;
}

video.addEventListener('play',() => {
    let canvas,displaySize;
    [canvas,displaySize] = face_status.init(video);
    
    // Temporary set oval  for testing only
    const oval = {
        x : 300,
        y : 100,
        w : 180,
        h : 200,
    }
    let result;

    const request_actions = ["happy","in_oval","turn_left","turn_right","straight","surprised","angry"]

    let current_request = request_actions[0];
    
    // Count number of request
    let author_score = 0;
    const FINISH_SOCRE = 4;

    setInterval(function(){
        draw_rectangle(canvas,oval);
        result = face_status.detect_face_status(video,canvas,displaySize,oval);
        result.then(text_pose => {
            // Clear canvas
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);
            // Write user action
            draw_text(canvas,"Detect status: "+ text_pose,{x:10,y:50});
            // Check condition 
            if (text_pose.includes(current_request) ) {
                current_request = getRequest(request_actions,current_request);
                author_score += 1;
                if (author_score > FINISH_SOCRE)
                    author_score = 0;
            };

            // Write request action
            draw_text(canvas,"Please "+ current_request,{x:10,y:350});
            // Write score:
            if (author_score < FINISH_SOCRE)
                draw_text(canvas,"Score: " + author_score,{x:10,y:300});
            else{
                draw_text(canvas,"PASS!",{x:10,y:300});
                current_request = request_actions[0];
            }
        });
    },250);



})

