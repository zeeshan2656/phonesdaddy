const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Basharat/Desktop/PHONESDADDY';
const stylePath = path.join(ROOT, 'public/css/style.css');
let styleContent = fs.readFileSync(stylePath, 'utf8');

const marker = 'Floating WhatsApp Contact Button';
const idx = styleContent.indexOf(marker);

if (idx !== -1) {
  // Find the start of the comment line before marker
  const commentStart = styleContent.lastIndexOf('/*', idx);
  const newStyle = `/* ==========================================================================
   Floating WhatsApp Contact Button (Dynamic Slide with Scroll-To-Top)
   ========================================================================== */

#whatsappFloatBtn {
  position: fixed;
  bottom: 28px; /* Default: Sits in bottom spot when scroll-to-top is hidden */
  right: 24px;
  z-index: 9998;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
  color: #fff;
  box-shadow: 0 4px 18px rgba(37, 211, 102, 0.42), 0 2px 8px rgba(0, 0, 0, 0.18);
  display: flex !important;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: bottom 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease, background 0.25s ease;
  animation: waPulseSubtle 3s infinite ease-in-out;
}

/* Smoothly slides up when the scroll-to-top button becomes visible */
#whatsappFloatBtn.has-scroll-btn {
  bottom: 86px;
}

@keyframes waPulseSubtle {
  0%, 100% {
    box-shadow: 0 4px 18px rgba(37, 211, 102, 0.42), 0 2px 8px rgba(0, 0, 0, 0.18);
  }
  50% {
    box-shadow: 0 6px 24px rgba(37, 211, 102, 0.62), 0 0 0 8px rgba(37, 211, 102, 0.14);
  }
}

#whatsappFloatBtn:hover {
  transform: translateY(-3px) scale(1.08);
  background: linear-gradient(135deg, #2ae06e 0%, #0d796c 100%);
  box-shadow: 0 8px 28px rgba(37, 211, 102, 0.65), 0 4px 12px rgba(0, 0, 0, 0.22);
  color: #fff;
}

#whatsappFloatBtn:active {
  transform: translateY(0) scale(0.96);
}

#whatsappFloatBtn svg,
#whatsappFloatBtn .whatsapp-icon {
  width: 28px;
  height: 28px;
  display: block;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.18));
}

/* Tooltip on hover */
#whatsappFloatBtn .whatsapp-tooltip {
  position: absolute;
  right: 58px;
  background: #0f172a;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 20px;
  white-space: nowrap;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  opacity: 0;
  visibility: hidden;
  transform: translateX(8px);
  transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;
  pointer-events: none;
  font-family: inherit;
}

#whatsappFloatBtn:hover .whatsapp-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(0);
}

/* Mobile adjustments for WhatsApp button */
@media (max-width: 768px) {
  #whatsappFloatBtn {
    bottom: 18px; /* Default at bottom on mobile */
    right: 14px;
    width: 42px;
    height: 42px;
  }
  #whatsappFloatBtn.has-scroll-btn {
    bottom: 68px; /* Slides up when topup button appears */
  }
  #whatsappFloatBtn svg,
  #whatsappFloatBtn .whatsapp-icon {
    width: 24px;
    height: 24px;
  }
  #whatsappFloatBtn .whatsapp-tooltip {
    display: none;
  }
}
`;
  styleContent = styleContent.slice(0, commentStart) + newStyle;
  fs.writeFileSync(stylePath, styleContent, 'utf8');
  console.log('✓ Successfully replaced style.css WhatsApp section!');
} else {
  console.error('Marker not found in style.css');
}
