// Constance
const STRAIGHT_POSE = [0, 0, 0]
const LEFT_POSE = [-1, 0, 0]
const RIGHT_POSE = [1, 0, 0]
const POSE_STRAIGHT_ABS_TOL = 0.2
const POSE_TURN_ABS_TOL = 0.1
const FACE_BOX_ABS_TOL = 20

const init=function(video){
    const canvas = faceapi.createCanvasFromMedia(video)
    document.body.append(canvas)
    const displaySize = { width: video.width, height: video.height}
    faceapi.matchDimensions(canvas,displaySize)

    return [canvas,displaySize]
}

const detect_expression = function(resizedDetections){
    const expr = resizedDetections[0].expressions;
    const keys   = Object.keys(expr);
    const highest_score = Math.max.apply(null, keys.map(function(x) { return expr[x]} ));
    const highest_expression = keys.filter(function(y) { return expr[y] === highest_score });
    console.log(highest_expression+ ":" + highest_score);
    return [highest_expression,highest_score];
}

const detect_face_status = async function(video,canvas,displaySize,oval){
    let result
    const detections = await faceapi.detectAllFaces(video,
        new faceapi.SsdMobilenetv1Options()).withFaceLandmarks().withFaceExpressions();
    //console.log(detections)
    const resizedDetections = faceapi.resizeResults(detections,displaySize);
    canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
    //faceapi.draw.drawDetections(canvas,resizedDetections)
    //faceapi.draw.drawFaceLandmarks(canvas,resizedDetections)
    if (resizedDetections.length == 0){
        result = "no_face";
        console.log(result);
        return result;
    }
        
    // Get face box:
    const face_box = {
        x : resizedDetections[0].detection.box.x,
        y : resizedDetections[0].detection.box.y,
        w : resizedDetections[0].detection.box.width,
        h : resizedDetections[0].detection.box.height,
    }
    console.log("face_box:" + JSON.stringify(face_box))

    // Estimate face pose
    const landmark={
        nose : getMeanPosition(resizedDetections[0].landmarks.getNose()),
        left_eye : getMeanPosition(resizedDetections[0].landmarks.getLeftEye()),
        right_eye : getMeanPosition(resizedDetections[0].landmarks.getRightEye()),
        chin : getMeanPosition([resizedDetections[0].landmarks.getJawOutline()[8]]),
    };
    // Get pose
    const pose = simple_pose_estimate(landmark,face_box)

    // Get conclude
    result = get_conclude(pose, face_box, oval);

    //Get expression
    let highest_expression,highest_score;
    [highest_expression,highest_score] = detect_expression(resizedDetections);
    result = highest_expression + "," + result;

    console.log(result)
    return result
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
    return approxeq(pose[0], LEFT_POSE[0],POSE_TURN_ABS_TOL) || (pose[0] < LEFT_POSE[0])
}

function is_turn_right_face(pose){
    return approxeq(pose[0], RIGHT_POSE[0],POSE_TURN_ABS_TOL) || (pose[0] > RIGHT_POSE[0])
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

    let posi_text = "";
    let pose_text = "";
    let conclusion = "";
    if (oval && is_rect_fix_oval(face_box,oval))
        posi_text = "in_oval"; 

    if (is_straight_face(pose))
        pose_text = conclusion+"straight";
    else if (is_turn_left_face(pose))
        pose_text = "turn_left"
    else if (is_turn_right_face(pose))
        pose_text = "turn_right"
    
    if (pose_text && posi_text)
        conclusion = pose_text + ","  + posi_text;
    else if (pose_text)
        conclusion = pose_text;
    else 
        conclusion = posi_text;

        
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

const simple_pose_estimate = function (landmark,face_box) {
    //Get middle point
    const middle = face_box.x + face_box.w/2;
    // Calib (middle point of nose only move haft way from center to left/right bbox border)
    const calib = 2;
    const yaw = (landmark.nose.x - middle)/(face_box.w/2)*calib;
    const pitch = 0;
    const roll = 0;
    console.log([yaw,pitch,roll])
    return [yaw,pitch,roll];
}

const face_status = {
    init,
    detect_face_status,
}

export default face_status