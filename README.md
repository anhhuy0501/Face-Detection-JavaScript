# API notes
## Require files
- `lib/face-api.min.js`
- Related moodels in `models/*`
- `src/face_status.js`

## Using example
### Import files js in `index.html`
```
  <script defer src="lib/face-api.min.js"></script>
  <script defer type="module" src="src/script.js"></script>
```
### Run script in in `src/script.js`
### Load models
```
Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('/models'),
]).then(startVideo)
```
### Start video
```
function startVideo(){
    navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => video.srcObject = stream)
    .then(() => new Promise(resolve => video.onloadedmetadata = resolve))
  
}
```
### Run face status recognize
```
video.addEventListener('play',() => {
    let canvas,displaySize;
    [canvas,displaySize] = face_status.init(video);
    const oval = {
        x : 300,
        y : 100,
        w : 180,
        h : 200,
    }
    result = face_status.detect_face_status(video,canvas,displaySize,oval);
}
```

## Return `result`
`result` is a string in following format:
```
face_status1,face_status2,face_status3
```
Example
```
happy,turn_left,in_oval
```




