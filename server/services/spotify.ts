// Spotify Integration Service
import { SpotifyApi } from "@spotify/web-api-ts-sdk";

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=spotify',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const refreshToken = connectionSettings?.settings?.oauth?.credentials?.refresh_token;
  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
  const clientId = connectionSettings?.settings?.oauth?.credentials?.client_id;
  const expiresIn = connectionSettings.settings?.oauth?.credentials?.expires_in;

  if (!connectionSettings || (!accessToken || !clientId || !refreshToken)) {
    throw new Error('Spotify not connected');
  }
  return { accessToken, clientId, refreshToken, expiresIn };
}

export async function getSpotifyClient() {
  const { accessToken, clientId, refreshToken, expiresIn } = await getAccessToken();

  const spotify = SpotifyApi.withAccessToken(clientId, {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn || 3600,
    refresh_token: refreshToken,
  });

  return spotify;
}

export async function searchTracks(query: string, limit: number = 8) {
  try {
    const spotify = await getSpotifyClient();
    const results = await spotify.search(query, ['track'], undefined, limit as 8);
    
    if (!results.tracks?.items) {
      return [];
    }

    return results.tracks.items.map(track => ({
      id: track.id,
      uri: track.uri,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      thumbnail: track.album.images[0]?.url || '',
      duration: formatDuration(track.duration_ms),
      previewUrl: track.preview_url,
      externalUrl: track.external_urls.spotify
    }));
  } catch (error: any) {
    console.error('[Spotify] Search error:', error.message);
    throw error;
  }
}

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export async function getCurrentUser() {
  try {
    const spotify = await getSpotifyClient();
    return await spotify.currentUser.profile();
  } catch (error: any) {
    console.error('[Spotify] Get user error:', error.message);
    throw error;
  }
}
