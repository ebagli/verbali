const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

let authToken: string | null = localStorage.getItem("auth_token");

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem("auth_token", token);
  } else {
    localStorage.removeItem("auth_token");
  }
}

export function getAuthToken() {
  return authToken;
}

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const headers: HeadersInit = {
    ...options.headers,
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }

  return response.json();
}

export const api = {
  auth: {
    login: async (email: string, password: string) => {
      const data = await fetchApi("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (data.token) {
        setAuthToken(data.token);
      }
      return data;
    },

    logout: async () => {
      await fetchApi("/auth/logout", { method: "POST" });
      setAuthToken(null);
    },

    getUser: async () => {
      return fetchApi("/auth/me");
    },
  },

  transcriptions: {
    list: async () => {
      return fetchApi("/transcriptions");
    },

    get: async (id: string) => {
      return fetchApi(`/transcriptions/${id}`);
    },

    create: async (data: { conversation_date: string; transcript_json: any[] }) => {
      return fetchApi("/transcriptions", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    update: async (id: string, data: any) => {
      return fetchApi(`/transcriptions/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },

    delete: async (id: string) => {
      return fetchApi(`/transcriptions/${id}`, { method: "DELETE" });
    },
  },

  speakers: {
    list: async () => {
      return fetchApi("/speakers");
    },

    create: async (data: { full_name: string; title: string }) => {
      return fetchApi("/speakers", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    delete: async (id: string) => {
      return fetchApi(`/speakers/${id}`, { method: "DELETE" });
    },
  },

  ai: {
    transcribe: async (audioFile: File) => {
      const formData = new FormData();
      formData.append("audio", audioFile);

      return fetchApi("/ai/transcribe", {
        method: "POST",
        body: formData,
      });
    },

    extractCases: async (transcript_text: string) => {
      return fetchApi("/ai/extract-cases", {
        method: "POST",
        body: JSON.stringify({ transcript_text }),
      });
    },
  },
};
