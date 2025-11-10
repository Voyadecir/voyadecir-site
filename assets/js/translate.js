document.addEventListener("DOMContentLoaded", function () {
  const btnUpload = document.getElementById("btn-upload");
  const btnCamera = document.getElementById("btn-camera");
  const fileInput = document.getElementById("file-input");
  const cameraInput = document.getElementById("camera-input");

  if (btnUpload && fileInput) {
    btnUpload.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      alert("File selected: " + file.name + "\\n(Here’s where we’ll plug in OCR/translation upload.)");
      // TODO: send to your backend OCR/translate endpoint
    });
  }

  if (btnCamera && cameraInput) {
    btnCamera.addEventListener("click", () => cameraInput.click());
    cameraInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      alert("Photo captured. We can run OCR on this in the next sprint.");
      // TODO: send image to OCR endpoint
    });
  }
});
