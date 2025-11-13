"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"

const AD_IMAGES = [
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SAI_16.10.2024_728x90_V%20%285%29-PcmPRpOnWic1QOTCp83jIJpFOlX4Ce.png",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SAI_16.10.2024_728x90_V%20%283%29-kImesFpX0SUriO6v9SzenXxmLdxryX.png",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SAI_16.10.2024_728x90_V%20%284%29-LuJQowRVN7GVVraIoiKH80U6Qt4PVY.png",
]

export function RotatingAdBanner() {
  const [currentAdIndex, setCurrentAdIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentAdIndex((prevIndex) => (prevIndex + 1) % AD_IMAGES.length)
    }, 3000) // Rotate every 3 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <Link href="https://bit.ly/OptionsSamurai" target="_blank" rel="noopener noreferrer" className="hidden lg:block">
      <div className="relative w-[728px] h-[90px] overflow-hidden">
        {AD_IMAGES.map((src, index) => (
          <div
            key={src}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentAdIndex ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={src || "/placeholder.svg"}
              alt="Options Samurai - Option Scanner"
              width={728}
              height={90}
              className="w-full h-full object-cover"
              priority={index === 0}
            />
          </div>
        ))}
      </div>
    </Link>
  )
}
