
"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, CheckCircle2, AlertTriangle, VideoOff, Loader2, ScanFace } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import * as faceapi from 'face-api.js';

interface FaceCaptureProps {
  onFaceCaptured: (dataUrl: string, descriptor: number[] | null) => void;
  captureButtonText?: string;
  imageSize?: number;
}

const FaceCapture: React.FC<FaceCaptureProps> = ({
  onFaceCaptured,
  captureButtonText = "Capture Face",
  imageSize = 300
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // For taking the snapshot
  const detectionCanvasRef = useRef<HTMLCanvasElement>(null); // For drawing real-time detections
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [descriptorModelsLoaded, setDescriptorModelsLoaded] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<string>("Initializing...");
  const [isFaceDetectedInPreview, setIsFaceDetectedInPreview] = useState(false);


  const { toast } = useToast();

  const streamRef = useRef(stream);
  const isCameraActiveRef = useRef(isCameraActive);
  const cameraOperationInProgress = useRef(false);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    isCameraActiveRef.current = isCameraActive;
  }, [isCameraActive]);

  const loadModels = useCallback(async () => {
    const MODEL_URL = '/models';
    setDetectionStatus("Loading face detection models...");
    console.log(`FaceCapture: Attempting to load models from base URL: ${MODEL_URL}`);
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      setModelsLoaded(true);
      setDetectionStatus("Detector models loaded. Loading recognition models...");
      console.log("FaceCapture: TinyFaceDetector models loaded successfully.");

      await Promise.all([
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      setDescriptorModelsLoaded(true);
      setDetectionStatus("All models loaded. Ready for face detection and recognition.");
      console.log("FaceCapture: Landmark and Recognition models loaded successfully.");

    } catch (e) {
      console.error("FaceCapture: Error loading models: ", e);
      const errorMsg = `Failed to load face detection/recognition models. Manifest files like 'tiny_face_detector_model-weights_manifest.json', 'face_landmark_68_model-weights_manifest.json', or 'face_recognition_model-weights_manifest.json' (and their shards) might be missing from '${MODEL_URL}/'. Real-time face outlines and descriptor extraction will NOT work. Please ensure model files are in 'public/models/'. Check browser Network tab for 404 errors.`;
      setError(errorMsg);
      setDetectionStatus(`Error: Models not found. Check 'public/models/' and Network tab for 404s on model manifest files. Details in console.`);
      toast({
        title: "Face Model Error (404 Likely)",
        description: `Could not load all required face-api.js models from ${MODEL_URL}/. Ensure 'tiny_face_detector_model', 'face_landmark_68_model', and 'face_recognition_model' (manifests & shards) are in your project's 'public/models/' directory. Check browser's Network tab for details. Face processing features will be limited.`,
        variant: "destructive",
        duration: 20000
      });
    }
  }, [toast]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const stopCamera = useCallback(() => {
    console.log("FaceCapture: stopCamera called.");
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (detectionCanvasRef.current) {
      const context = detectionCanvasRef.current.getContext('2d');
      context?.clearRect(0, 0, detectionCanvasRef.current.width, detectionCanvasRef.current.height);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      console.log("FaceCapture: Media stream tracks stopped.");
    }
    setStream(null);
    setIsCameraActive(false);
    setIsFaceDetectedInPreview(false);
  }, []);

  const startDetection = useCallback(() => {
    if (!videoRef.current || !detectionCanvasRef.current || !modelsLoaded || !isCameraActiveRef.current) {
      return;
    }
    console.log("FaceCapture: Starting real-time detection interval.");

    const video = videoRef.current;
    const canvas = detectionCanvasRef.current;
    const displaySize = { width: video.videoWidth, height: video.videoHeight };

    if (displaySize.width === 0 || displaySize.height === 0) {
        console.warn("FaceCapture: Video dimensions are zero, cannot start detection yet.");
        return;
    }

    faceapi.matchDimensions(canvas, displaySize);

    detectionIntervalRef.current = setInterval(async () => {
      if (video.paused || video.ended || !isCameraActiveRef.current) {
        if(detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
        setIsFaceDetectedInPreview(false);
        return;
      }

      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 }));
      setIsFaceDetectedInPreview(detections.length > 0);

      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      const context = canvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
      }
    }, 200);
  }, [modelsLoaded]);


  const startCamera = useCallback(async () => {
    console.log("FaceCapture: Attempting to start camera. In progress:", cameraOperationInProgress.current, "Active:", isCameraActiveRef.current);
    if (cameraOperationInProgress.current) {
      console.log("FaceCapture: Camera operation already in progress, skipping.");
      return;
    }
    if (isCameraActiveRef.current && streamRef.current) {
      console.log("FaceCapture: Camera already active and stream exists, skipping.");
      return;
    }

    cameraOperationInProgress.current = true;
    setError(null);
    setImageDataUrl(null);
    setIsStartingCamera(true);
    setIsCameraActive(false);
    setIsFaceDetectedInPreview(false);
    console.log("FaceCapture: Set isStartingCamera to true.");

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: imageSize, height: imageSize } });
        console.log("FaceCapture: Got user media stream.");
        setStream(mediaStream);
      } else {
        const msg = "Camera access not supported by your browser.";
        setError(msg); toast({ title: "Error", description: msg, variant: "destructive" });
        setIsStartingCamera(false); cameraOperationInProgress.current = false;
        console.error("FaceCapture: " + msg);
      }
    } catch (err) {
      let message = "Error accessing camera. Please ensure permissions are granted.";
      if (err instanceof Error) {
        message = `Error accessing camera: ${err.name} - ${err.message}. Please ensure permissions are granted.`;
        if (err.name === "NotAllowedError") {
          message = "Camera access denied. Please enable camera permissions in your browser settings.";
        } else if (err.name === "NotFoundError") {
          message = "No camera found. Please ensure a camera is connected and enabled.";
        }
      }
      setError(message); toast({ title: "Camera Error", description: message, variant: "destructive" });
      setStream(null); setIsCameraActive(false); setIsStartingCamera(false); cameraOperationInProgress.current = false;
      console.error("FaceCapture: " + message, err);
    }
  }, [imageSize, toast]);

  useEffect(() => {
    // This effect should run once on mount if no image is present and camera isn't active/starting.
    if (!imageDataUrl && !isCameraActiveRef.current && !streamRef.current && !cameraOperationInProgress.current && !error) {
      console.log("FaceCapture: Auto-starting camera via useEffect.");
      startCamera();
    }
  // The dependency array is intentionally simple to control auto-start behavior.
  // Adding more reactive values here could cause unintended restarts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDataUrl, error, startCamera]);


  useEffect(() => {
    const videoNode = videoRef.current;
    if (videoNode && stream) {
      console.log("FaceCapture: Stream available, assigning to video element.");
      videoNode.srcObject = stream;
      videoNode.onloadedmetadata = () => {
        console.log("FaceCapture: Video metadata loaded. Video dimensions:", videoNode.videoWidth, videoNode.videoHeight);
        videoNode.play()
          .then(() => {
            console.log("FaceCapture: Video playback started successfully.");
            setIsCameraActive(true);
            setIsStartingCamera(false);
            setError(null);
            cameraOperationInProgress.current = false;
            if (modelsLoaded) startDetection();
          })
          .catch(playError => {
            console.error("FaceCapture: Error playing video stream:", playError);
            let message = "Could not start video playback. Ensure browser allows autoplay or try starting manually.";
            if (playError instanceof Error && playError.name === "NotAllowedError") {
              message = "Video playback not allowed by browser. Please click 'Start Camera'.";
            } else if (playError instanceof Error && (playError.message.includes("interrupted") || playError.name === "AbortError") ) {
                message = "Video playback interrupted. This can happen with rapid camera restarts or if models are still loading. Please try again in a moment or click 'Retry Camera'.";
            }
            setError(message); toast({ title: "Camera Playback Error", description: message, variant: "destructive" });
            setIsCameraActive(false); setIsStartingCamera(false); cameraOperationInProgress.current = false;
            stopCamera();
          });
      };
      videoNode.onerror = (e) => {
        console.error("FaceCapture: Video element error:", e);
        setError("An error occurred with the video stream.");
        setIsCameraActive(false); setIsStartingCamera(false); cameraOperationInProgress.current = false;
        stopCamera();
      };
    } else if (videoNode && !stream) {
      console.log("FaceCapture: Stream is null, clearing video srcObject.");
      videoNode.srcObject = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, modelsLoaded, startDetection, stopCamera, toast]);

  useEffect(() => {
    return () => {
      console.log("FaceCapture: Component unmounting, stopping camera.");
      stopCamera();
      if (cameraOperationInProgress.current) cameraOperationInProgress.current = false;
    };
  }, [stopCamera]);

  const captureFace = async () => {
    if (videoRef.current && canvasRef.current && stream && isCameraActive && isFaceDetectedInPreview) {
      setIsTakingPicture(true);
      const video = videoRef.current;
      const captureCanvas = canvasRef.current;
      captureCanvas.width = video.videoWidth;
      captureCanvas.height = video.videoHeight;
      const context = captureCanvas.getContext('2d');
      if (context) {
        context.translate(video.videoWidth, 0);
        context.scale(-1, 1); // Mirror the snapshot
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        context.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
      }
      const dataUrl = captureCanvas.toDataURL('image/png');
      setImageDataUrl(dataUrl);

      // Now compute descriptor
      let descriptor: number[] | null = null;
      if (descriptorModelsLoaded) {
        try {
          // Need to use an HTMLImageElement for face-api.js processing from dataUrl
          const img = document.createElement('img');
          img.src = dataUrl;
          await new Promise((resolve, reject) => { // Wait for image to load
            img.onload = resolve;
            img.onerror = reject;
          });

          const detectionResult = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                                              .withFaceLandmarks()
                                              .withFaceDescriptor();
          if (detectionResult) {
            descriptor = Array.from(detectionResult.descriptor); // Convert Float32Array to number[]
            console.log("FaceCapture: Descriptor computed successfully.");
          } else {
            console.warn("FaceCapture: Could not compute descriptor, face not detected in captured image.");
            toast({title: "Descriptor Warning", description: "Could not compute face descriptor from the captured image. Try a clearer shot.", variant: "default", duration: 5000});
          }
        } catch (descError) {
          console.error("FaceCapture: Error computing descriptor:", descError);
          toast({title: "Descriptor Error", description: "Failed to compute face descriptor.", variant: "destructive"});
        }
      } else {
        console.warn("FaceCapture: Descriptor models not loaded, cannot compute descriptor.");
        toast({title: "Models Missing", description: "Recognition models not loaded. Descriptor cannot be computed.", variant: "destructive"});
      }
      
      setIsTakingPicture(false);
      onFaceCaptured(dataUrl, descriptor); // Pass descriptor (or null) to parent
      stopCamera(); // Stop camera after capture and descriptor computation
      
    } else if (!isCameraActive) {
        toast({ title: "Camera Off", description: "Please start the camera first.", variant: "destructive" });
    } else if (!isFaceDetectedInPreview) {
        toast({ title: "No Face Detected", description: "Please ensure your face is clearly visible in the frame.", variant: "destructive" });
    }
  };


  const handleRetake = () => {
    setImageDataUrl(null);
    setError(null);
    setIsFaceDetectedInPreview(false);

    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (!isCameraActiveRef.current && !cameraOperationInProgress.current) {
      console.log("FaceCapture: Retake - camera not active, starting camera.");
      startCamera();
    } else if (isCameraActiveRef.current && modelsLoaded) {
      console.log("FaceCapture: Retake - camera active, restarting detection.");
      startDetection();
    } else if (isCameraActiveRef.current && !modelsLoaded) {
        console.log("FaceCapture: Retake - camera active, models not loaded. Detection will not restart.");
    }
  };

  const previewStyle = { width: `${imageSize}px`, height: `${imageSize}px` };

  let previewMessageArea = null;
  if (isStartingCamera && !isCameraActive && !imageDataUrl) {
    previewMessageArea = (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 p-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-foreground">Starting camera...</p>
      </div>
    );
  } else if ((!modelsLoaded || !descriptorModelsLoaded) && detectionStatus.startsWith("Error:")) {
    previewMessageArea = (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/10 p-4 text-center">
        <AlertTriangle size={imageSize / 5} className="mb-2 text-destructive" />
        <p className="text-sm font-semibold text-destructive">Face Models Failed to Load</p>
        <p className="text-xs text-destructive/80 mt-1">{detectionStatus}</p>
        <p className="text-xs text-muted-foreground mt-2">
          Verify model files are in `public/models/`. Check browser Network tab for 404 errors.
        </p>
      </div>
    );
  } else if (error && !isCameraActive && !imageDataUrl) {
    previewMessageArea = (
      <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground absolute inset-0 p-4 text-center">
        <VideoOff size={imageSize / 4} className="mb-2" />
        <p className="text-sm text-destructive">{error}</p>
        {(!modelsLoaded || !descriptorModelsLoaded) && detectionStatus && !detectionStatus.startsWith("Error:") && <p className="text-xs text-muted-foreground mt-1">{detectionStatus}</p>}
      </div>
    );
  } else if (!isCameraActive && !imageDataUrl && !isStartingCamera) {
    previewMessageArea = (
      <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground absolute inset-0 p-4 text-center">
        <VideoOff size={imageSize / 4} className="mb-2" />
        <p className="text-sm">Camera is off or unavailable.</p>
        {(!modelsLoaded || !descriptorModelsLoaded) && detectionStatus && !detectionStatus.startsWith("Error:") &&  <p className="text-xs text-muted-foreground mt-1">{detectionStatus}</p>}
      </div>
    );
  }


  const showVideoFeed = isCameraActive && !imageDataUrl;
  let captureButtonDynamicText = captureButtonText;
  const allModelsFullyLoaded = modelsLoaded && descriptorModelsLoaded;

  if (showVideoFeed && !allModelsFullyLoaded && !detectionStatus.startsWith("Error:")) {
    captureButtonDynamicText = "Models Loading...";
  } else if (showVideoFeed && !allModelsFullyLoaded && detectionStatus.startsWith("Error:")){
    captureButtonDynamicText = "Detector Models Missing";
  } else if (showVideoFeed && allModelsFullyLoaded && !isFaceDetectedInPreview) {
    captureButtonDynamicText = "Position Face in Frame";
  }


  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <div
        className="relative rounded-lg overflow-hidden border-2 border-dashed border-primary bg-muted data-[capturing=true]:animate-pulse-border"
        style={previewStyle}
        data-capturing={showVideoFeed && !isTakingPicture && allModelsFullyLoaded && isFaceDetectedInPreview}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "object-cover w-full h-full transform scaleX-[-1]",
            { 'hidden': !showVideoFeed }
          )}
          onPlay={() => {
            console.log("FaceCapture: Video onPlay event triggered.");
            if (modelsLoaded && isCameraActiveRef.current && !detectionIntervalRef.current) { // only detector models needed for preview
              startDetection();
            }
          }}
        />
        <canvas
            ref={detectionCanvasRef}
            className={cn(
              "absolute top-0 left-0 w-full h-full object-cover transform scaleX-[-1]",
              { 'hidden': !modelsLoaded || !showVideoFeed } // only detector models needed for preview
            )}
            style={previewStyle}
        />
        {imageDataUrl && (
          <img src={imageDataUrl} alt="Captured face" className="object-cover w-full h-full absolute inset-0" />
        )}

        {previewMessageArea}

        {showVideoFeed && (!allModelsFullyLoaded) && detectionStatus && !detectionStatus.startsWith("Error:") && (
            <div className="absolute bottom-2 left-2 right-2 bg-black/50 text-white text-xs p-1 rounded text-center">
                <Loader2 className="inline-block h-3 w-3 mr-1 animate-spin" />
                {detectionStatus}
            </div>
        )}
         {showVideoFeed && allModelsFullyLoaded && !isFaceDetectedInPreview && !isStartingCamera && (
          <div className="absolute bottom-2 left-2 right-2 bg-amber-500/80 text-white text-xs p-1 rounded text-center font-medium">
            Position your face in the frame.
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden"></canvas> {/* For capturing image and descriptor processing */}


      {(!isCameraActive && !showVideoFeed && !imageDataUrl) && (
         <Button onClick={startCamera} className="w-full" variant="outline" disabled={isStartingCamera || cameraOperationInProgress.current}>
          {(isStartingCamera || cameraOperationInProgress.current) ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Camera size={18} className="mr-2" />}
          {(isStartingCamera || cameraOperationInProgress.current) ? "Starting..." : (error || detectionStatus.startsWith("Error:") ? "Retry Camera" : "Start Camera")}
        </Button>
      )}

      {showVideoFeed && (
        <Button onClick={captureFace} disabled={isTakingPicture || !allModelsFullyLoaded || !isFaceDetectedInPreview} className="w-full bg-accent hover:bg-accent/90">
          {isTakingPicture ? <Loader2 size={18} className="mr-2 animate-spin" /> : <ScanFace size={18} className="mr-2" />}
          {isTakingPicture ? 'Processing...' : captureButtonDynamicText}
        </Button>
      )}

      {imageDataUrl && (
        // No confirm button here, onFaceCaptured is called directly after capture + descriptor processing.
        // Parent component will decide what to do (e.g. show confirm, or proceed)
        // For simplicity here, we just offer retake.
        <div className="flex gap-2 w-full">
          <Button onClick={handleRetake} variant="outline" className="w-full" disabled={cameraOperationInProgress.current || isStartingCamera}>
            <RefreshCw size={18} className="mr-2" />
            Retake
          </Button>
        </div>
      )}
    </div>
  );
};

export default FaceCapture;
