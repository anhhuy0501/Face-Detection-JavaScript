//const opnecv = require("opencv.js");
//cv = opnecv.cv
//const pose_estimate = require('./pose_estimate')
import pose_est from "./pose_estimate.js"
const video = document.getElementById('video')

Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
]).then(startVideo)

function startVideo(){
    navigator.getUserMedia(
        {video:{}},
        stream => video.srcObject = stream,
        err => console.error(err)
    )
}
startVideo()

const draw_rectangle = function(canvas,rec){


    //Draw rectangle for testing
    var ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.rect(rec.x, rec.y, rec.w, rec.h);
    ctx.stroke();
}

video.addEventListener('play',() => {
    let canvas,displaySize;
    [canvas,displaySize] = pose_est.init(video);
    
    // Temporary set oval  for testing only
    const oval = {
        x : 344.4855028167367,
        y : 143.15230764448643,
        w : 166.22570246458054,
        h : 182.8557866513729,
    }

    setInterval(function(){
        pose_est.detect_pose(video,canvas,displaySize,oval);
        draw_rectangle(canvas,oval);
    },100);
})

