/**
 * Abhinav Uniforms Client Tracking Portal - Subdomain Configuration
 *
 * When hosting this tracking portal on a separate subdomain
 * (e.g. https://track.abhinavuniforms.com or https://track.yourdomain.com):
 *
 * Set `apiUrl` below to your backend API endpoint.
 * - If your backend API is at https://api.abhinavuniforms.com, set:
 *     apiUrl: "https://api.abhinavuniforms.com"
 * - If you leave it empty (""), it will automatically auto-detect based on the domain!
 */
window.TRACK_CONFIG = {
  // Backend API URL (leave empty "" for automatic auto-detection)
  apiUrl: "https://abhinav-uniform-flow-backend.vercel.app",
};
