import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { validateQrToken } from "../utils/qr-token";

/**
 * Html5Qrcode lifecycle — camera selection, start/stop, scan success callback.
 * Menggantikan inline scanner logic di DashboardPegawai.
 *
 * @param {{ enabled: boolean, onScanSuccess: (decodedText: string) => void, onScanError?: (error: any) => void, fps?: number, qrbox?: { width: number, height: number } }} params
 * @returns {{ startScanning: () => void, stopScanning: () => void, isScanning: boolean, scanResult: object|null, resetResult: () => void }}
 */
export function useQrScanner({
  enabled = false,
  onScanSuccess,
  onScanError,
  fps = 10,
  qrbox = { width: 250, height: 250 },
} = {}) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const isValidatingScan = useRef(false);
  const scannerRef = useRef(null);
  const cancelledRef = useRef(false);
  const onScanSuccessRef = useRef(onScanSuccess);

  // Keep callback ref in sync
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  const resetResult = useCallback(() => {
    setScanResult(null);
    isValidatingScan.current = false;
  }, []);

  const stopScanning = useCallback(async () => {
    if (!scannerRef.current) return;
    cancelledRef.current = true;
    try {
      await scannerRef.current.stop();
    } catch (error) {
      console.error("Error stopping scanner:", error?.message);
    }
    try {
      await scannerRef.current.clear();
    } catch (error) {
      console.error("Error clearing scanner:", error?.message);
    }
    scannerRef.current = null;
    setIsScanning(false);
  }, []);

  const startScanning = useCallback(async () => {
    if (isValidatingScan.current) return;
    resetResult();

    let scanner;
    try {
      scanner = new Html5Qrcode("qr-reader");
    } catch (error) {
      console.error("Gagal inisialisasi scanner:", error);
      return;
    }

    cancelledRef.current = false;
    scannerRef.current = scanner;

    try {
      const cameras = await Html5Qrcode.getCameras();
      const rearCamera = cameras.find((cam) =>
        /back|rear|environment/i.test(cam.label)
      );
      const selectedCamera = rearCamera || cameras[0];

      if (!selectedCamera) {
        console.error("Tidak ada kamera tersedia");
        return;
      }

      if (cancelledRef.current) return;

      const onScanSuccessWrapper = async (decodedText) => {
        if (cancelledRef.current || isValidatingScan.current) return;
        isValidatingScan.current = true;

        try {
          const result = await validateQrToken(decodedText);
          if (cancelledRef.current) return;
          setScanResult(result);
          if (onScanSuccessRef.current) {
            onScanSuccessRef.current(result);
          }
          if (result.type === "valid") {
            await stopScanning();
          }
        } catch (error) {
          console.error("Gagal validasi QR:", error);
          if (!cancelledRef.current) {
            setScanResult({ type: "invalid", label: "INVALID TOKEN" });
          }
          if (onScanError) onScanError(error);
          await stopScanning();
        }
      };

      const scanConfig = { fps, qrbox };
      const preferredCameraConfig = rearCamera
        ? rearCamera.id
        : { facingMode: "environment" };

      try {
        await scanner.start(preferredCameraConfig, scanConfig, onScanSuccessWrapper);
      } catch (error) {
        if (cancelledRef.current) return;
        if (rearCamera) throw error;
        try {
          await scanner.start(selectedCamera.id, scanConfig, onScanSuccessWrapper);
        } catch (fallbackError) {
          console.error("Gagal start scanner dengan fallback:", fallbackError);
          throw fallbackError;
        }
      }

      setIsScanning(true);
    } catch (error) {
      console.error("Gagal memulai scanner:", error);
      await stopScanning();
    }
  }, [fps, qrbox, resetResult, stopScanning, onScanError]);

  useEffect(() => {
    if (!enabled) {
      cancelledRef.current = true;
      if (scannerRef.current) {
        stopScanning();
      }
    }
  }, [enabled, stopScanning]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (scannerRef.current) {
        stopScanning();
      }
    };
  }, [stopScanning]);

  return {
    startScanning,
    stopScanning,
    isScanning,
    scanResult,
    setScanResult,
    resetResult,
  };
}
