//const KalmanFilter = require('kalmanjs')
const kf1 = new KalmanFilter({R: 1, Q: 10});
const kf2 = new KalmanFilter({R: 1, Q: 10});
const kf3 = new KalmanFilter({R: 1, Q: 10});

// Constance
const STRAIGHT_POSE = [0, 0, 0]
const LEFT_POSE = [1, 0, 0]
const RIGHT_POSE = [-1, 0, 0]
const POSE_ABS_TOL = 0.1
const POSE_TURN_ABS_TOL = 0.4
const REL_TOL = 0.1
const OVAL_LTRB = [250, 90, 380, 220]
const POSE_STABLE_TOL = 0.3

// Calib
const MAX_LEFT_POSE = 16
const MAX_RIGHT_POSE = 20

// Find Landmark from video
const detect_landmark_and_pose = function(video) {
    const canvas = faceapi.createCanvasFromMedia(video)
    document.body.append(canvas)
    const displaySize = { width: video.width, height: video.height}
    faceapi.matchDimensions(canvas,displaySize)


    //Draw rectangle for testing

    canvas.getContext('2d').
    setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video,
            new faceapi.SsdMobilenetv1Options()).withFaceLandmarks()
        console.log(detections)
        const resizedDetections = faceapi.resizeResults(detections,displaySize)
        canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height)
        faceapi.draw.drawDetections(canvas,resizedDetections)
        faceapi.draw.drawFaceLandmarks(canvas,resizedDetections)

        
        // Get face box:
        const face_box = {
            x : detections[0].alignedRect.box.x,
            y : detections[0].alignedRect.box.y,
            h : detections[0].alignedRect.box.height,
            w : detections[0].alignedRect.box.width,
        }

        // Temporary set oval = face_bax for testing only
        const oval = face_box

        // Estimate face pose
        const landmark={
            nose : getMeanPosition(detections[0].landmarks.getNose()),
            left_eye : getMeanPosition(detections[0].landmarks.getLeftEye()),
            right_eye : getMeanPosition(detections[0].landmarks.getRightEye()),
            chin : getMeanPosition([detections[0].landmarks.getJawOutline()[8]]),
        };
        // Get pose
        const pose = pose_estimate(landmark, video.width, video.height);
        // Get conclude
        const result = get_conclude(pose, face_box, oval);
        
        console.log(result)

    },100)
}

const approxeq = function(v1, v2, abs_tol,rel_tol) {
    if (abs_tol !== null) {
        return Math.abs(v1 - v2) < abs_tol;
    }
    if (rel_tol !== null) {
        return (Math.abs(v1 - v2) <= rel_tol * Math.min(Math.abs(v1), Math.abs(v2))) ;
    }
    return v1===v2
    
};



function is_straight_face(pose){
    return approxeq(pose[0], STRAIGHT_POSE[0],POSE_ABS_TOL) 
}

function is_rect_fix_oval(rec, oval){
    return  (   
        approxeq(rec.x, oval.x, null, REL_TOL) 
        && approxeq(rec.y, oval.y, null, REL_TOL) 
        && approxeq(rec.w, oval.w, null, REL_TOL)
        //&& approxeq(rec.w, oval.w, null, REL_TOL)
    );
}

function is_straight_and_in_oval(pose, face_box, oval){
    if (is_straight_face(pose) && is_rect_fix_oval(face_box, oval)){
        return true;
    }
    return false; 
}

const get_conclude = function(pose, face_box, oval=null) {
    let conclusion;
    if (oval && is_straight_and_in_oval(pose, face_box, oval))
        conclusion = "straight_and_in_oval";
    else if (is_straight_face(pose))
        conclusion = "straight";
    /*
        elif is_turn_left_face(pose):
        conclusion = "turn_left"
    elif is_turn_right_face(pose):
        conclusion = "turn_right"
        */
    else
        conclusion = "unknown";
    return conclusion
}


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
    //console.log(    "Rotation Vector (in degree):",    rvec.data64F.map(d => (d / Math.PI) * 180));

    // Todo: Need check the ralated of rvec and angle formular again!!!
    let yaw,pitch,roll
    [yaw,pitch,roll] = rvec.data64F.map(d => (d / Math.PI) * 180);
    
    if (yaw >= 0){
        yaw = Math.max(0,180 - yaw)/MAX_RIGHT_POSE;
    }else{
        yaw = Math.min(0,-180 -yaw)/MAX_LEFT_POSE;
    }
    yaw = kf1.filter(yaw)
    pitch = kf2.filter(pitch)
    roll = kf3.filter(roll)
    console.log([yaw,pitch,roll]);
    return [yaw,pitch,roll] ;
}
/*
const ps = {
    detect_landmark_and_pose,
    get_conclude
}
*/
export default detect_landmark_and_pose