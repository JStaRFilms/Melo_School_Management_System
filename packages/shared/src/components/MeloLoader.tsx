import React from "react";

/**
 * Premium branded animated loader used application-wide.
 * Self-contained — ships its own CSS via an inline <style> block so it works
 * in every app (admin, teacher, portal, platform) without relying on a
 * host-app stylesheet or CSS custom properties.
 */
export function MeloLoader({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="melo-loader-container">
      <style dangerouslySetInnerHTML={{ __html: meloLoaderCSS }} />
      <div className="melo-loader-spinner">
        <div className="melo-loader-ring"></div>
        <div className="melo-loader-ring"></div>
        <div className="melo-loader-ring"></div>
        <div className="melo-loader-inner">M</div>
      </div>
      <p className="melo-loader-text">{message}</p>
    </div>
  );
}

const meloLoaderCSS = `
.melo-loader-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 350px;
  width: 100%;
  padding: 2rem;
  text-align: center;
  animation: meloFadeIn 0.3s ease-in-out;
}
.melo-loader-spinner {
  position: relative;
  width: 64px;
  height: 64px;
  margin-bottom: 1.5rem;
}
.melo-loader-ring {
  box-sizing: border-box;
  display: block;
  position: absolute;
  width: 64px;
  height: 64px;
  border: 4px solid hsl(227, 100%, 92%);
  border-radius: 50%;
  animation: meloLoaderPulse 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  border-color: hsl(227, 58%, 35%) transparent transparent transparent;
}
.melo-loader-ring:nth-child(1) {
  animation-delay: -0.45s;
}
.melo-loader-ring:nth-child(2) {
  animation-delay: -0.3s;
}
.melo-loader-ring:nth-child(3) {
  animation-delay: -0.15s;
}
.melo-loader-inner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: hsl(227, 100%, 92%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 14px;
  color: hsl(227, 58%, 35%);
  box-shadow: 0 0 12px hsl(227, 100%, 92%);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
.melo-loader-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: #64748b;
  letter-spacing: -0.01em;
  margin: 0;
  max-width: 320px;
  line-height: 1.5;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
@keyframes meloLoaderPulse {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes meloFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
