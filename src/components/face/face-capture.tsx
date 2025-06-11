
"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, CheckCircle2, AlertTriangle, VideoOff, Loader2, ScanFace } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import * as faceapi from 'face-api.js';

interface FaceCaptureProps {
  onFaceCaptured: (dataUrl: string) => void;
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
  const [detectionStatus, setDetectionStatus] = useState<string>("Loading models...");
  
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
    const MODEL_URL = '/models'; // face-api.js will fetch from public/models folder
    setDetectionStatus("Loading detection models...");
    try {
      // Ensure you have these models in your /public/models folder
      // Download them from the face-api.js repository (weights folder)
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        // If you want to draw landmarks, uncomment this and ensure the model is in public/models
        // faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL), 
      ]);
      setModelsLoaded(true);
      setDetectionStatus("Models loaded. Ready for detection.");
      console.log("FaceCapture: Models loaded successfully.");
    } catch (e) {
      console.error("FaceCapture: Error loading models: ", e);
      const errorMsg = "Failed to load face detection models. Real-time detection overlay will not be available. Please ensure model files are in public/models/";
      setError(errorMsg);
      setDetectionStatus("Error loading models. Check console.");
      toast({ 
        title: "Model Load Error", 
        description: "Could not load face detection models from /models. Real-time detection features will be unavailable. Please check the console for more details and ensure model files are correctly placed in the public/models directory.", 
        variant: "destructive",
        duration: 10000 // Show for longer
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
    setIsCameraActive(false); // Ensure camera active state is reset
  }, []);

  const startDetection = useCallback(() => {
    if (!videoRef.current || !detectionCanvasRef.current || !modelsLoaded || !isCameraActiveRef.current) {
      // console.log("FaceCapture: Detection prerequisites not met.", { video: !!videoRef.current, canvas: !!detectionCanvasRef.current, modelsLoaded, isCameraActive: isCameraActiveRef.current });
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
        return;
      }
      
      // Using TinyFaceDetectorOptions: faster but less accurate. inputSize can be tuned.
      // Higher scoreThreshold means stricter detection.
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 }));
      // To draw landmarks:
      // const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 })).withFaceLandmarks(true);


      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      const context = canvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        // To draw landmarks:
        // faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
      }
    }, 200); // Adjust interval as needed for performance
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
    setImageDataUrl(null); // Clear previous image
    setIsStartingCamera(true);
    setIsCameraActive(false); // Explicitly set to false before starting
    console.log("FaceCapture: Set isStartingCamera to true.");

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: imageSize, height: imageSize } });
        console.log("FaceCapture: Got user media stream.");
        setStream(mediaStream);
        // Video element handling will be in useEffect watching 'stream'
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

  // Effect to auto-start camera if conditions are met (e.g., no image captured, not active, not already starting)
  useEffect(() => {
    if (!imageDataUrl && !isCameraActiveRef.current && !streamRef.current && !cameraOperationInProgress.current && !error) {
      console.log("FaceCapture: Auto-starting camera via useEffect.");
      startCamera();
    }
  }, [imageDataUrl, error, startCamera]); // Dependencies ensure this runs when state allows a start attempt.

  // Effect to handle stream when it's set (from startCamera)
  useEffect(() => {
    const videoNode = videoRef.current;
    if (videoNode && stream) {
      console.log("FaceCapture: Stream available, assigning to video element.");
      videoNode.srcObject = stream;
      // onloadedmetadata is crucial
      videoNode.onloadedmetadata = () => {
        console.log("FaceCapture: Video metadata loaded. Video dimensions:", videoNode.videoWidth, videoNode.videoHeight);
        videoNode.play()
          .then(() => {
            console.log("FaceCapture: Video playback started successfully.");
            setIsCameraActive(true); // This is key
            setIsStartingCamera(false); 
            setError(null);
            cameraOperationInProgress.current = false;
            if (modelsLoaded) startDetection(); // Start detection after video plays
          })
          .catch(playError => {
            console.error("FaceCapture: Error playing video stream:", playError);
            let message = "Could not start video playback. Please ensure your browser allows autoplay or try starting the camera manually.";
            if (playError instanceof Error && playError.name === "NotAllowedError") {
              message = "Video playback was not allowed, possibly due to browser autoplay policies. Please click 'Start Camera'.";
            }
            setError(message); toast({ title: "Camera Playback Error", description: message, variant: "destructive" });
            setIsCameraActive(false); setIsStartingCamera(false); cameraOperationInProgress.current = false;
            stopCamera(); // Clean up stream if play fails
          });
      };
      videoNode.onerror = (e) => { // Handle potential errors on the video element itself
        console.error("FaceCapture: Video element error:", e);
        setError("An error occurred with the video stream.");
        setIsCameraActive(false); setIsStartingCamera(false); cameraOperationInProgress.current = false;
        stopCamera();
      };
    } else if (videoNode && !stream) {
      console.log("FaceCapture: Stream is null, clearing video srcObject.");
      videoNode.srcObject = null;
    }
    // Cleanup function for when stream changes or component unmounts
    // return () => {
    //   if (videoNode) {
    //     videoNode.onloadedmetadata = null;
    //     videoNode.onerror = null;
    //   }
    // };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, modelsLoaded]); // Added modelsLoaded to re-trigger if models load after stream

  // General cleanup effect
  useEffect(() => {
    return () => {
      console.log("FaceCapture: Component unmounting, stopping camera.");
      stopCamera();
      if (cameraOperationInProgress.current) cameraOperationInProgress.current = false; // Reset guard
    };
  }, [stopCamera]);

  const captureFace = () => {
    if (videoRef.current && canvasRef.current && stream && isCameraActive) {
      setIsTakingPicture(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        // Flip the image horizontally because the video feed is mirrored
        context.translate(video.videoWidth, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        // Reset the context transform to avoid affecting subsequent draws (if any)
        context.setTransform(1, 0, 0, 1, 0, 0); 
      }
      const dataUrl = canvas.toDataURL('image/png');
      setImageDataUrl(dataUrl);
      setIsTakingPicture(false);
      // Optionally stop detection here if preferred, or keep it running for retake
      // if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    } else if (!isCameraActive) {
        toast({ title: "Camera Off", description: "Please start the camera first.", variant: "destructive" });
    }
  };

  const handleConfirm = () => {
    if (imageDataUrl) {
      onFaceCaptured(imageDataUrl);
      stopCamera(); // Stop camera after confirming to release resources
    }
  };

  const handleRetake = () => {
    setImageDataUrl(null);
    setError(null);
    if (detectionIntervalRef.current) { // Clear old interval if any
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    // If camera isn't active and no operation is in progress, start it.
    if (!isCameraActiveRef.current && !cameraOperationInProgress.current) { 
      console.log("FaceCapture: Retake - camera not active, starting camera.");
      startCamera();
    } else if (isCameraActiveRef.current && modelsLoaded) {
      // If camera is active and models loaded, restart detection.
      console.log("FaceCapture: Retake - camera active, restarting detection.");
      startDetection();
    }
  };
  
  const previewStyle = { width: `${imageSize}px`, height: `${imageSize}px` };

  // Determine visibility states more clearly
  const showStartingCameraMessage = isStartingCamera && !isCameraActive && !imageDataUrl;
  const showVideoFeed = isCameraActive && !imageDataUrl;
  const showCameraOffMessage = !isCameraActive && !imageDataUrl && !isStartingCamera && !error; // Only show if not attempting to start and no error
  const showErrorMessage = error && !isCameraActive && !imageDataUrl;


  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <div 
        className="relative rounded-lg overflow-hidden border-2 border-dashed border-primary bg-muted data-[capturing=true]:animate-pulse-border"
        style={previewStyle}
        data-capturing={showVideoFeed && !isTakingPicture}
      >
        {/* Video element is always rendered when expected for stream, visibility controlled by CSS if needed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline // Important for iOS
          muted // Muting is often required for autoplay
          className={cn(
            "object-cover w-full h-full transform scaleX-[-1]", // Mirror the video feed
            { 'hidden': !showVideoFeed } // Hide if not showing video feed
          )}
          onPlay={() => { // Moved startDetection to onPlay to ensure video is ready
            console.log("FaceCapture: Video onPlay event triggered.");
            if (modelsLoaded && isCameraActiveRef.current && !detectionIntervalRef.current) {
              startDetection();
            }
          }}
        />
        {/* Detection canvas for drawing boxes */}
        <canvas 
            ref={detectionCanvasRef} 
            className="absolute top-0 left-0 w-full h-full object-cover transform scaleX-[-1]" // Mirrored like the video
            style={previewStyle} 
        />
        {imageDataUrl && (
          <img src={imageDataUrl} alt="Captured face" className="object-cover w-full h-full absolute inset-0" />
        )}
        {showStartingCameraMessage && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 p-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-sm text-foreground">Starting camera...</p>
            </div>
         )}
        {(showCameraOffMessage || showErrorMessage) && (
          <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground absolute inset-0 p-4 text-center">
            <VideoOff size={imageSize / 4} className="mb-2" />
            {showErrorMessage && <p className="text-sm text-destructive">{error}</p>}
            {showCameraOffMessage && <p className="text-sm">Camera is off or unavailable.</p>}
            {!modelsLoaded && detectionStatus && <p className="text-xs text-muted-foreground mt-1">{detectionStatus}</p>}
          </div>
        )}
        {/* Show model loading status over video if video is active but models are not yet loaded */}
        {showVideoFeed && !modelsLoaded && detectionStatus && (
            <div className="absolute bottom-2 left-2 right-2 bg-black/50 text-white text-xs p-1 rounded text-center">
                <Loader2 className="inline-block h-3 w-3 mr-1 animate-spin" />
                {detectionStatus}
            </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden"></canvas> {/* For taking the actual snapshot */}


      {/* Show "Start Camera" or "Retry" button if camera is off, or if there was an error */}
      {(showErrorMessage || showCameraOffMessage) && (
         <Button onClick={startCamera} className="w-full" variant="outline" disabled={isStartingCamera || cameraOperationInProgress.current}>
          {(isStartingCamera || cameraOperationInProgress.current) ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Camera size={18} className="mr-2" />}
          {(isStartingCamera || cameraOperationInProgress.current) ? "Starting..." : (error ? "Retry Camera" : "Start Camera")}
        </Button>
      )}
      
      {/* Show "Capture" button only when video feed is active */}
      {showVideoFeed && (
        <Button onClick={captureFace} disabled={isTakingPicture || !modelsLoaded} className="w-full bg-accent hover:bg-accent/90">
          {isTakingPicture ? <Loader2 size={18} className="mr-2 animate-spin" /> : <ScanFace size={18} className="mr-2" />}
          {isTakingPicture ? 'Capturing...' : (modelsLoaded ? captureButtonText : 'Loading Detector...')}
        </Button>
      )}

      {/* Show "Retake" and "Confirm" buttons only when an image has been captured */}
      {imageDataUrl && (
        <div className="flex gap-2 w-full">
          <Button onClick={handleRetake} variant="outline" className="flex-1" disabled={cameraOperationInProgress.current || isStartingCamera}>
            <RefreshCw size={18} className="mr-2" />
            Retake
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            <CheckCircle2 size={18} className="mr-2" />
            Confirm Photo
          </Button>
        </div>
      )}
    </div>
  );
};

export default FaceCapture;

    