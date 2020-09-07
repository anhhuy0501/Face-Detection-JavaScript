//const opnecv = require("opencv.js");
//cv = opnecv.cv
//const pose_estimate = require('./pose_estimate')
import detect_landmark_and_pose from "./pose_estimate.js"
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



video.addEventListener('play',() => {
/*
    const canvas = faceapi.createCanvasFromMedia(video)
    document.body.append(canvas)
    const displaySize = { width: video.width, height: video.height}
    faceapi.matchDimensions(canvas,displaySize)
    setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video,
            new faceapi.SsdMobilenetv1Options()).withFaceLandmarks()
        console.log(detections)
        const resizedDetections = faceapi.resizeResults(detections,displaySize)
        canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height)
        faceapi.draw.drawDetections(canvas,resizedDetections)
        faceapi.draw.drawFaceLandmarks(canvas,resizedDetections)
        

        // Estimate face pose
        const landmark={
            nose : getMeanPosition(detections[0].landmarks.getNose()),
            left_eye : getMeanPosition(detections[0].landmarks.getLeftEye()),
            right_eye : getMeanPosition(detections[0].landmarks.getRightEye()),
            chin : getMeanPosition([detections[0].landmarks.getJawOutline()[8]]),
        }

        pose_estimate(landmark,video.width,video.height)
        // rotation vector (in degree 180)
        //const rotation_vector = [-32.530263974401926, -40.41493964075018, -167.0025791654042]
    },100)
*/
    detect_landmark_and_pose(video)
    
})

