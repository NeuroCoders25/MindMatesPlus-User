const API_BASE_URL = 'http://10.0.2.2:8000';

export interface KnnRecommendRequest {
  depression_score: number;
  anxiety_score: number;
  stress_score: number;
  dominant_emotion: string;
  emotion_confidence: number;
}

export interface KnnRecommendResponse {
  recommended_group: string;
  description: string;
  probabilities: Record<string, number>;
  disclaimer: string;
}

export interface MlPredictResponse {
  prediction: string;
  confidence: number;
  probabilities: {
    depression: number;
    anxiety: number;
    normal: number;
  };
}

export const recommendGroups = async (
  payload: KnnRecommendRequest
): Promise<KnnRecommendResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/recommend-groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`KNN API responded with status ${response.status}`);
    }
    return response.json() as Promise<KnnRecommendResponse>;
  } catch (error) {
    console.error('[KNN] recommendGroups error:', error);
    throw error;
  }
};

export const predictText = async (text: string): Promise<MlPredictResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      throw new Error(`ML API responded with status ${response.status}`);
    }
    return response.json() as Promise<MlPredictResponse>;
  } catch (error) {
    console.error('predictText error:', error);
    throw error;
  }
};
