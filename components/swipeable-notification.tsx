"use client"

import { useState } from "react"
import { motion, AnimatePresence, useAnimation } from "framer-motion"
import { Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export function SwipeableNotification({ notification, children }: { notification: any; children: React.ReactNode }) {
  const [isPresent, setIsPresent] = useState(true)
  const controls = useAnimation()

  const handleDragEnd = async (event: any, info: any) => {
    // If swiped right far enough
    if (info.offset.x > 100) {
      // Animate it off screen
      await controls.start({ x: 500, opacity: 0, transition: { duration: 0.2 } })
      
      const supabase = createClient()
      const { error } = await supabase.from("notifications").delete().eq("id", notification.id)
      
      if (error) {
        toast.error("Failed to dismiss notification")
        // animate back
        controls.start({ x: 0, opacity: 1 })
      } else {
        setIsPresent(false)
      }
    } else {
      // Snap back if not swiped far enough
      controls.start({ x: 0 })
    }
  }

  return (
    <AnimatePresence>
      {isPresent && (
        <motion.li
          layout
          initial={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0, padding: 0, margin: 0, transition: { duration: 0.2 } }}
          className="relative overflow-hidden"
        >
          {/* Background trash icon revealed on swipe right */}
          <div className="absolute inset-y-0 left-0 bg-destructive/10 w-full flex items-center px-4 z-0">
            <Trash2 className="size-5 text-destructive" />
          </div>

          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            animate={controls}
            className="relative z-10 bg-card py-3 flex items-start gap-3 w-full touch-pan-y"
          >
            {children}
          </motion.div>
        </motion.li>
      )}
    </AnimatePresence>
  )
}
