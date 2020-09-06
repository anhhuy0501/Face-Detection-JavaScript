//const opnecv = require("opencv.js");
//cv = opnecv.cv

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

function getMeanPosition(ls) {
    ls = ls
      .map((a) => [a.x, a.y])
      .reduce((a, b) => [a[0] + b[0], a[1] + b[1]])
      .map((a) => a / ls.length);
    return {
        x: ls[0],
        y: ls[1],
    }
}

video.addEventListener('play',() => {
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
        landmark={
            nose : getMeanPosition(detections[0].landmarks.getNose()),
            left_eye : getMeanPosition(detections[0].landmarks.getLeftEye()),
            right_eye : getMeanPosition(detections[0].landmarks.getRightEye()),
            chin : getMeanPosition([detections[0].landmarks.getJawOutline()[8]]),
        }

        pose_estimate(landmark,width=video.width,height=video.height)
        // rotation vector (in degree 180)
        rotation_vector = [-32.530263974401926, -40.41493964075018, -167.0025791654042]
    },100)

    
})

function pose_estimate(landmark,width=720,height=405) {
    // 3D model points
    const numRows = 4;
    const modelPoints = cv.matFromArray(numRows, 3, cv.CV_64FC1, [
    0.0,
    0.0,
    0.0, // Nose tip
    //0.0,
    //0.0,
    //0.0, // HACK! solvePnP doesn't work with 3 points, so copied the
    //   first point to make the input 4 points
    0.0, -330.0, -65.0,  // Chin
    -225.0,
    170.0,
    -135.0, // Left eye left corner
    225.0,
    170.0,
    -135.0 // Right eye right corne
    // -150.0, -150.0, -125.0,  // Left Mouth corner
    // 150.0, -150.0, -125.0,  // Right mouth corner
    ]);

    // Camera internals
    const size = { width: width, height: height };
    const focalLength = size.width;
    const center = [size.width / 2, size.height / 2];
    const cameraMatrix = cv.matFromArray(3, 3, cv.CV_64FC1, [
        focalLength,
        0,
        center[0],
        0,
        focalLength,
        center[1],
        0,
        0,
        1
    ]);
    //console.log("Camera Matrix:", cameraMatrix.data64F);

    // Create Matrixes
    const imagePoints = cv.Mat.zeros(numRows, 2, cv.CV_64FC1);
    const distCoeffs = cv.Mat.zeros(4, 1, cv.CV_64FC1); // Assuming no lens distortion
    const rvec = new cv.Mat({ width: 1, height: 3 }, cv.CV_64FC1);
    const tvec = new cv.Mat({ width: 1, height: 3 }, cv.CV_64FC1);
    const pointZ = cv.matFromArray(1, 3, cv.CV_64FC1, [0.0, 0.0, 500.0]);
    const pointY = cv.matFromArray(1, 3, cv.CV_64FC1, [0.0, 500.0, 0.0]);
    const pointX = cv.matFromArray(1, 3, cv.CV_64FC1, [500.0, 0.0, 0.0]);
    const noseEndPoint2DZ = new cv.Mat();
    const nose_end_point2DY = new cv.Mat();
    const nose_end_point2DX = new cv.Mat();
    const jaco = new cv.Mat();

    // Finish init

    // Pose estimate
    const ns = landmark.nose;
    const le = landmark.left_eye;
    const re = landmark.right_eye;
    const chin = landmark.chin;
    
    // 2D image points. If you change the image, you need to change vector
    [
    ns.x,
    ns.y, // Nose tip
    //ns.x,
    //ns.y, // Nose tip (see HACK! above)
    chin.x,
    chin.y,// Chin
    le.x,
    le.y, // Left eye left corner
    re.x,
    re.y // Right eye right corner
    // 345, 465, // Left Mouth corner
    // 453, 469 // Right mouth corner
    ].map((v, i) => {
    imagePoints.data64F[i] = v;
    });  
    
    // Hack! initialize transition and rotation matrixes to improve estimation
    tvec.data64F[0] = -100;
    tvec.data64F[1] = 100;
    tvec.data64F[2] = 1000;
    const distToLeftEyeX = Math.abs(le.x - ns.x);
    const distToRightEyeX = Math.abs(re.x - ns.x);

    //rvec.data64F[0] = 0;
    //rvec.data64F[1] = 0;
    //rvec.data64F[2] = 0;


    if (distToLeftEyeX < distToRightEyeX) {
        // looking at left
        rvec.data64F[0] = -1.0;
        rvec.data64F[1] = -0.75;
        rvec.data64F[2] = -3.0;
    } else {
        // looking at right
        rvec.data64F[0] = 1.0;
        rvec.data64F[1] = -0.75;
        rvec.data64F[2] = -3.0;
    }

    const success = cv.solvePnP(
    modelPoints,
    imagePoints,
    cameraMatrix,
    distCoeffs,
    rvec,
    tvec,
    true
    );
    if (!success) {
    return;
    }
    //console.log("Rotation Vector:", rvec.data64F);
    //console.log(
    //"Rotation Vector (in degree):",
    //rvec.data64F.map(d => (d / Math.PI) * 180)
    //);
    //console.log(
    //"Rotation:",
    //rvec.data64F.map(d => Math.round(100*(d/Math.abs(d)*(Math.PI-Math.abs(d)))/Math.PI))
    //);
    //console.log("Translation Vector:", tvec.data64F);    

    cv.projectPoints(
    pointZ,
    rvec,
    tvec,
    cameraMatrix,
    distCoeffs,
    noseEndPoint2DZ,
    jaco
    );
    cv.projectPoints(
    pointY,
    rvec,
    tvec,
    cameraMatrix,
    distCoeffs,
    nose_end_point2DY,
    jaco
    );
    cv.projectPoints(
    pointX,
    rvec,
    tvec,
    cameraMatrix,
    distCoeffs,
    nose_end_point2DX,
    jaco
    );

    let im = cv.imread(document.querySelector("canvas"));
    // color the detected eyes and nose to purple
    for (var i = 0; i < numRows; i++) {
    cv.circle(
        im,
        {
        x: imagePoints.doublePtr(i, 0)[0],
        y: imagePoints.doublePtr(i, 1)[0]
        },
        3,
        [255, 0, 255, 255],
        -1
    );
    }
    // draw axis
    const pNose = { x: imagePoints.data64F[0], y: imagePoints.data64F[1] };
    const pZ = {
    x: noseEndPoint2DZ.data64F[0],
    y: noseEndPoint2DZ.data64F[1]
    };
    const p3 = {
    x: nose_end_point2DY.data64F[0],
    y: nose_end_point2DY.data64F[1]
    };
    const p4 = {
    x: nose_end_point2DX.data64F[0],
    y: nose_end_point2DX.data64F[1]
    };

    v_x = {
        x: pNose.x - pZ.x,
        y: pNose.y - pZ.y
    }
    console.log(v_x)
    cv.line(im, pNose, pZ, [255, 0, 0, 255], 2);
    cv.line(im, pNose, p3, [0, 255, 0, 255], 2);
    cv.line(im, pNose, p4, [0, 0, 255, 255], 2);

    // Display image
    cv.imshow(document.querySelector("canvas"), im);
    im.delete();

}