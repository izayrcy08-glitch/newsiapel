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

  // Config disimpan di ref supaya identitas startScanning STABIL.
  // Tanpa ini, `qrbox` (objek baru tiap render) bikin startScanning berubah
  // identitas → useEffect pemanggil jalan ulang tiap detik (karena jam berdetak)
  // → kamera restart terus → layar putih berkedip.
  const fpsRef = useRef(fps);
  const qrboxRef = useRef(qrbox);
  useEffect(() => {
    fpsRef.current = fps;
    qrboxRef.current = qrbox;
  });

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
    const scanner = scannerRef.current;
    scannerRef.current = null;
    
    try {
      await scanner.stop();
    } catch (error) {
      if (error?.name !== 'AbortError' && error && typeof error === 'object') {
        console.debug("Scanner stop error:", error.message || String(error));
      }
    }
    
    try {
      await scanner.clear();
    } catch (error) {
      if (error?.name !== 'AbortError' && error && typeof error === 'object') {
        console.debug("Scanner clear error:", error.message || String(error));
      }
    }
    
    setIsScanning(false);
  }, []);

  const startScanning = useCallback(async () => {
    if (isValidatingScan.current) return;
    // Guard anti double-start: jika scanner sudah ada (sedang jalan/inisialisasi),
    // jangan bikin instance baru. Ini yang mencegah kamera restart berulang.
    if (scannerRef.current) return;
    resetResult();

    let scanner;
    try {
      scanner = new Html5Qrcode("qr-reader");
    } catch (error) {
      console.error("Gagal inisialisasi scanner:", error);
      setScanResult({ type: "error", label: "SCANNER INIT FAILED" });
      return;
    }

    cancelledRef.current = false;
    scannerRef.current = scanner;

    try {
      const camerasPromise = Html5Qrcode.getCameras();
      const camerasTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Camera detection timeout")), 5000)
      );
      
      const cameras = await Promise.race([camerasPromise, camerasTimeout]);
      
      if (!cameras || cameras.length === 0) {
        console.error("Tidak ada kamera tersedia");
        setScanResult({ type: "error", label: "NO CAMERA FOUND" });
        await stopScanning();
        return;
      }

      const rearCamera = cameras.find((cam) =>
        /back|rear|environment/i.test(cam.label)
      );
      const selectedCamera = rearCamera || cameras[0];

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
          } else {
            isValidatingScan.current = false;
          }
        } catch (error) {
          if (!cancelledRef.current) {
            console.error("Gagal validasi QR:", error);
            setScanResult({ type: "invalid", label: "Token tidak valid — coba lagi" });
            isValidatingScan.current = false;
          }
          if (onScanError && !cancelledRef.current) onScanError(error);
        }
      };

      const scanConfig = { fps: fpsRef.current, qrbox: qrboxRef.current };
      const preferredCameraConfig = rearCamera
        ? rearCamera.id
        : { facingMode: "environment" };

      const startPromise = scanner.start(preferredCameraConfig, scanConfig, onScanSuccessWrapper);
      const startTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Camera start timeout")), 5000)
      );

      try {
        await Promise.race([startPromise, startTimeout]);
      } catch (error) {
        if (cancelledRef.current) return;
        if (rearCamera) throw error;
        try {
          const fallbackPromise = scanner.start(selectedCamera.id, scanConfig, onScanSuccessWrapper);
          const fallbackTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Camera start timeout")), 5000)
          );
          await Promise.race([fallbackPromise, fallbackTimeout]);
        } catch (fallbackError) {
          console.error("Gagal start scanner dengan fallback:", fallbackError);
          setScanResult({ type: "error", label: "CAMERA START FAILED" });
          throw fallbackError;
        }
      }

      setIsScanning(true);
    } catch (error) {
      console.error("Gagal memulai scanner:", error);
      if (!cancelledRef.current) {
        setScanResult({ type: "error", label: "SCANNER ERROR" });
      }
      await stopScanning();
    }
  }, [resetResult, stopScanning, onScanError]);

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
