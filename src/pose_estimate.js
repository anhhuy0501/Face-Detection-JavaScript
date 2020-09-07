//const KalmanFilter = require('kalmanjs')
const kf1 = new KalmanFilter({R: 1, Q: 10});
const kf2 = new KalmanFilter({R: 1, Q: 10});
const kf3 = new KalmanFilter({R: 1, Q: 10});
//const kf = new KalmanFilter();

// Find Landmark from video
const detect_landmark_and_pose = function(video) {
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
        
        // Get face box:
        const bbox = {
            x : detections[0].alignedRect.box.x,
            y : detections[0].alignedRect.box.y,
            h : detections[0].alignedRect.box.height,
            w : detections[0].alignedRect.box.width,
        }
        // Estimate face pose
        const landmark={
            nose : getMeanPosition(detections[0].landmarks.getNose()),
            left_eye : getMeanPosition(detections[0].landmarks.getLeftEye()),
            right_eye : getMeanPosition(detections[0].landmarks.getRightEye()),
            chin : getMeanPosition([detections[0].landmarks.getJawOutline()[8]]),
        }
        const pose = pose_estimate(landmark, video.width, video.height)
        
        // Get conclude


    },100)
}
/*
function get_conclude(yaw,) {
    if oval_ltrb and is_straight_and_in_oval(pose, roi_box, oval_ltrb):
        conclusion = "straight_and_in_oval"
    elif is_straight_face(pose):
        conclusion = "straight"
    elif is_turn_left_face(pose):
        conclusion = "turn_left"
    elif is_turn_right_face(pose):
        conclusion = "turn_right"
    else:
    conclusion = "unknown" 
}
*/

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

// Estimate pose from landmark
const pose_estimate = function (landmark,width=720,height=405) {
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
    console.log(
    "Rotation Vector (in degree):",
    rvec.data64F.map(d => (d / Math.PI) * 180));
    let yaw,pitch,roll
    [yaw,pitch,roll] = rvec.data64F.map(d => (d / Math.PI) * 180);
    
    if (yaw >= 0){
        yaw = Math.max(0,180 - yaw);
    }else{
        yaw = Math.min(0,-180 -yaw);
    }
    yaw = kf1.filter(yaw)
    pitch = kf2.filter(pitch)
    roll = kf3.filter(roll)
    console.log([yaw,pitch,roll]);
    return yaw,pitch,roll ;
}

export default detect_landmark_and_pose