//const KalmanFilter = require('kalmanjs')
const kf1 = new KalmanFilter({R: 1, Q: 10});
const kf2 = new KalmanFilter({R: 1, Q: 10});
const kf3 = new KalmanFilter({R: 1, Q: 10});

// Constance
const STRAIGHT_POSE = [0, 0, 0]
const LEFT_POSE = [-1, 0, 0]
const RIGHT_POSE = [1, 0, 0]
const POSE_STRAIGHT_ABS_TOL = 0.12
const POSE_TURN_ABS_TOL = 0.2
const REL_TOL = 0.05
const OVAL_LTRB = [250, 90, 380, 220]
const POSE_STABLE_TOL = 0.3
const FACE_BOX_ABS_TOL = 10

// Calib
const MAX_LEFT_POSE = 16
const MAX_RIGHT_POSE = 20


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
        const face_box = {
            x : detections[0].alignedRect.box.x,
            y : detections[0].alignedRect.box.y,
            w : detections[0].alignedRect.box.width,
            h : detections[0].alignedRect.box.height,
        }

        // Temporary set oval  for testing only
        const oval = {
            x : 344.4855028167367,
            y : 143.15230764448643,
            w : 166.22570246458054,
            h : 182.8557866513729,
        }
        //Draw rectangle for testing
        var ctx = canvas.getContext("2d");
        ctx.beginPath();
        ctx.rect(oval.x, oval.y, oval.w, oval.h);
        ctx.stroke();

        // Estimate face pose
        const landmark={
            nose : getMeanPosition(detections[0].landmarks.getNose()),
            left_eye : getMeanPosition(detections[0].landmarks.getLeftEye()),
            right_eye : getMeanPosition(detections[0].landmarks.getRightEye()),
            chin : getMeanPosition([detections[0].landmarks.getJawOutline()[8]]),
        };
        // Get pose
        //const pose = pose_estimate(landmark, video.width, video.height);
        const pose = simple_pose_estimate(landmark,face_box)
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
    return approxeq(pose[0], STRAIGHT_POSE[0],POSE_STRAIGHT_ABS_TOL) 
}

function is_turn_left_face(pose){
    return approxeq(pose[0], LEFT_POSE[0],POSE_TURN_ABS_TOL)
}

function is_turn_right_face(pose){
    return approxeq(pose[0], RIGHT_POSE[0],POSE_TURN_ABS_TOL)
}

function is_rect_fix_oval(rec, oval){
    return  (   
           approxeq(rec.x+rec.w/2, oval.x+oval.w/2, FACE_BOX_ABS_TOL) 
        && approxeq(rec.y+rec.h/2, oval.y+oval.h/2, FACE_BOX_ABS_TOL) 
        && approxeq(rec.w, oval.w, FACE_BOX_ABS_TOL)
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
    else if (is_turn_left_face(pose))
        conclusion = "turn_left"
    else if (is_turn_right_face(pose))
        conclusion = "turn_right"
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

function yawpitchrolldecomposition(R){
    sin_x    = Math.sqrt(R[2,0] * R[2,0] +  R[2,1] * R[2,1])    
    validity  = sin_x < 1e-6
    if (!validity ){
        z1    = Math.atan2(R[2,0], R[2,1])     // around z1-axis
        x      = Math.atan2(sin_x,  R[2,2])    // around x-axis
        z2    = Math.atan2(R[0,2], -R[1,2])    // around z2-axis
    }
    else{
        z1    = 0                               // around z1-axis
        x      = math.atan2(sin_x,  R[2,2])     // around x-axis
        z2    = 0                               // around z2-axis
    }
    return [z1, x, z2]
}

const simple_pose_estimate = function (landmark,face_box) {
    //Get middle point
    const middle = face_box.x + face_box.w/2;
    // Calib
    const calib = 2;
    const yaw = (landmark.nose.x - middle)/(face_box.w/2)*calib;
    const pitch = 0;
    const roll = 0;
    console.log([yaw,pitch,roll])
    return [yaw,pitch,roll];
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
    
    // Corrected method but not have Rodrigues in js yet.
    //rmat = cv.Rodrigues(rvec)[0]
    //yawpitchroll_angles = yawpitchrolldecomposition(rmat).map(d => -180*d/Math.PI);
    //yawpitchroll_angles[1,0] = yawpitchroll_angles[1,0]+90;
    //[yaw,pitch,roll] = yawpitchroll_angles;
    

    if (yaw >= 0){
        yaw = Math.max(0,180 - yaw )/MAX_RIGHT_POSE;
    }else{
        yaw = Math.min(0,-180 -yaw) /MAX_LEFT_POSE;
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