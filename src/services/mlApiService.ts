const API_BASE_URL = 'http://192.168.1.3:8000';

export interface MlPredictResponse {
  prediction: string;
  confidence: number;
  probabilities: {
    depression: number;
    anxiety: number;
    normal: number;
  };
}

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
