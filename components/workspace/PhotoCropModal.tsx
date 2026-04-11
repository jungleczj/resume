'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Check, Loader2 } from 'lucide-react'

interface PhotoCropModalProps {
  file: File
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

// Crop state: all values are in display (canvas) pixel space
interface CropBox {
  x: number
  y: number
  width: number  // height is always width * 3/2 (2:3 aspect ratio)
}

const ASPECT_H_OVER_W = 3 / 2 // height = width * 1.5  (2:3 width:height)
const CONTAINER_MAX = 400      // max display width of the image area

export function PhotoCropModal({ file, onConfirm, onCancel }: PhotoCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Display scale: image is drawn at this scale inside the canvas
  const scaleRef = useRef<number>(1)

  // Crop box in display pixels
  const [cropBox, setCropBox] = useState<CropBox>({ x: 0, y: 0, width: 0 })
  const cropBoxRef = useRef<CropBox>({ x: 0, y: 0, width: 0 })

  const [dragging, setDragging] = useState(false)
  const dragStartRef = useRef<{ mx: number; my: number; bx: number; by: number } | null>(null)

  const [imageLoaded, setImageLoaded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })

  // Keep ref in sync so draw() always sees latest crop
  useEffect(() => {
    cropBoxRef.current = cropBox
  }, [cropBox])

  // Load image from File
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img

      // Scale image to fit within CONTAINER_MAX on width
      const scale = Math.min(CONTAINER_MAX / img.naturalWidth, 1)
      scaleRef.current = scale

      const dw = Math.round(img.naturalWidth * scale)
      const dh = Math.round(img.naturalHeight * scale)
      setCanvasSize({ w: dw, h: dh })

      // Initial crop box: full display width, centered vertically
      const cropW = dw
      const cropH = Math.round(cropW * ASPECT_H_OVER_W)
      const clampedH = Math.min(cropH, dh)
      const actualW = Math.round(clampedH / ASPECT_H_OVER_W)
      const initialBox: CropBox = {
        x: Math.round((dw - actualW) / 2),
        y: Math.round((dh - clampedH) / 2),
        width: actualW,
      }
      setCropBox(initialBox)
      cropBoxRef.current = initialBox
      setImageLoaded(true)
    }
    img.onerror = () => {
      // Malformed image — bail out gracefully
      onCancel()
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file, onCancel])

  // Draw image + crop overlay whenever cropBox or canvasSize changes
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !imageLoaded) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { w, h } = canvasSize
    canvas.width = w
    canvas.height = h

    // Draw scaled image
    ctx.drawImage(img, 0, 0, w, h)

    const box = cropBoxRef.current
    const boxH = Math.round(box.width * ASPECT_H_OVER_W)

    // Darken everything outside the crop box
    ctx.fillStyle = 'rgba(0,0,0,0.50)'
    // Top strip
    ctx.fillRect(0, 0, w, box.y)
    // Bottom strip
    ctx.fillRect(0, box.y + boxH, w, h - (box.y + boxH))
    // Left strip
    ctx.fillRect(0, box.y, box.x, boxH)
    // Right strip
    ctx.fillRect(box.x + box.width, box.y, w - (box.x + box.width), boxH)

    // Crop box border
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(box.x + 0.75, box.y + 0.75, box.width - 1.5, boxH - 1.5)

    // Rule-of-thirds guide lines inside the box
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1
    const third = box.width / 3
    const thirdH = boxH / 3
    for (let i = 1; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(box.x + third * i, box.y)
      ctx.lineTo(box.x + third * i, box.y + boxH)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(box.x, box.y + thirdH * i)
      ctx.lineTo(box.x + box.width, box.y + thirdH * i)
      ctx.stroke()
    }

    // Corner handles
    const hs = 8
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    const corners = [
      [box.x, box.y],
      [box.x + box.width - hs, box.y],
      [box.x, box.y + boxH - hs],
      [box.x + box.width - hs, box.y + boxH - hs],
    ]
    for (const [cx, cy] of corners) {
      ctx.fillRect(cx, cy, hs, hs)
    }
  }, [imageLoaded, canvasSize])

  useEffect(() => {
    draw()
  }, [draw, cropBox])

  // ── Pointer event handlers ────────────────────────────────────────────────────

  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      mx: e.clientX - rect.left,
      my: e.clientY - rect.top,
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const { mx, my } = getCanvasPos(e)
    dragStartRef.current = { mx, my, bx: cropBoxRef.current.x, by: cropBoxRef.current.y }
    setDragging(true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging || !dragStartRef.current) return

    const { mx, my } = getCanvasPos(e)
    const dx = mx - dragStartRef.current.mx
    const dy = my - dragStartRef.current.my

    const box = cropBoxRef.current
    const boxH = Math.round(box.width * ASPECT_H_OVER_W)
    const { w, h } = canvasSize

    // New top-left, clamped to canvas bounds
    const newX = Math.max(0, Math.min(w - box.width, dragStartRef.current.bx + dx))
    const newY = Math.max(0, Math.min(h - boxH, dragStartRef.current.by + dy))

    setCropBox(prev => ({ ...prev, x: newX, y: newY }))
  }

  const handlePointerUp = () => {
    setDragging(false)
    dragStartRef.current = null
  }

  // ── Confirm: extract crop region onto an offscreen canvas → Blob ──────────────

  const handleConfirm = () => {
    const img = imgRef.current
    if (!img || confirming) return

    setConfirming(true)

    const box = cropBoxRef.current
    const scale = scaleRef.current
    const boxH = Math.round(box.width * ASPECT_H_OVER_W)

    // Convert display-pixel coordinates back to natural image coordinates
    const srcX = Math.round(box.x / scale)
    const srcY = Math.round(box.y / scale)
    const srcW = Math.round(box.width / scale)
    const srcH = Math.round(boxH / scale)

    // Output canvas at native resolution (cropped)
    const out = document.createElement('canvas')
    out.width = srcW
    out.height = srcH
    const ctx = out.getContext('2d')!
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH)

    out.toBlob(
      (blob) => {
        setConfirming(false)
        if (blob) onConfirm(blob)
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-w-[480px] w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">裁剪照片 (2:3)</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            aria-label="取消"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas crop area */}
        <div className="flex items-center justify-center bg-gray-900 p-4">
          {!imageLoaded ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={canvasSize.w}
              height={canvasSize.h}
              style={{
                cursor: dragging ? 'grabbing' : 'grab',
                maxWidth: '100%',
                display: 'block',
                userSelect: 'none',
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          )}
        </div>

        {/* Hint */}
        <p className="text-center text-xs text-gray-400 px-5 pt-3 pb-1">
          拖动裁剪框调整位置
        </p>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!imageLoaded || confirming}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {confirming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            确认裁剪
          </button>
        </div>
      </div>
    </div>
  )
}
