const axios = require('axios');

class AIService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.model = 'deepseek/deepseek-chat-v3.1:free';
  }

  async analyzeSymptoms(symptoms, chatHistory = []) {
    try {
      console.log('🤖 AI analyzing symptoms:', symptoms);

      const prompt = this.buildMedicalPrompt(symptoms, chatHistory);
      
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1000,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:5000',
            'X-Title': 'HospitalLink AI'
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      console.log('🤖 AI Response received');

      return this.parseAIResponse(aiResponse);

    } catch (error) {
      console.error('❌ AI Service Error:', error.response?.data || error.message);
      
      // Fallback to rule-based analysis if AI fails
      console.log('🔄 Falling back to rule-based analysis');
      return this.fallbackAnalysis(symptoms);
    }
  }

  getSystemPrompt() {
    return `Anda adalah AI medical assistant untuk HospitalLink, sebuah aplikasi konsultasi kesehatan di Indonesia. 

TUGAS ANDA:
1. Analisis gejala yang diberikan pasien
2. Tentukan tingkat keparahan (LOW, MEDIUM, HIGH)
3. Berikan rekomendasi awal
4. Tentukan apakah perlu konsultasi dokter atau tidak

ATURAN PENTING:
- TIDAK memberikan diagnosis pasti
- SELALU sarankan konsultasi dokter untuk gejala serius
- Gunakan bahasa Indonesia yang mudah dipahami
- Fokus pada triage dan screening awal
- Jika ragu, selalu arahkan ke dokter

FORMAT RESPONSE (JSON):
{
  "severity": "LOW|MEDIUM|HIGH",
  "confidence": 0.8,
  "recommendation": "SELF_CARE|DOCTOR_CONSULTATION|EMERGENCY",
  "message": "Penjelasan dalam bahasa Indonesia",
  "needsDoctor": true/false,
  "estimatedConsultationTime": 5-15,
  "symptoms_analysis": {
    "primary_symptoms": [],
    "severity_indicators": [],
    "red_flags": []
  }
}

EMERGENCY KEYWORDS: kejang, sesak berat, nyeri dada, pingsan, perdarahan hebat, demam tinggi >39°C
URGENT KEYWORDS: demam >38°C, muntah terus, sakit perut hebat, sesak napas
NORMAL KEYWORDS: batuk ringan, pilek, sakit kepala ringan, pusing`;
  }

  buildMedicalPrompt(symptoms, chatHistory) {
    let prompt = `ANALISIS GEJALA PASIEN:\n\n`;
    
    if (Array.isArray(symptoms)) {
      prompt += `Gejala yang dilaporkan: ${symptoms.join(', ')}\n\n`;
    } else {
      prompt += `Gejala yang dilaporkan: ${symptoms}\n\n`;
    }

    if (chatHistory && chatHistory.length > 0) {
      prompt += `RIWAYAT CHAT:\n`;
      chatHistory.forEach((msg, index) => {
        prompt += `${msg.isUser ? 'Pasien' : 'AI'}: ${msg.text}\n`;
      });
      prompt += `\n`;
    }

    prompt += `Mohon analisis dan berikan rekomendasi dalam format JSON yang telah ditentukan.`;

    return prompt;
  }

  parseAIResponse(aiResponse) {
    try {
      // Extract JSON from AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate and normalize response
        return {
          severity: parsed.severity || 'MEDIUM',
          confidence: parsed.confidence || 0.7,
          recommendation: parsed.recommendation || 'DOCTOR_CONSULTATION',
          message: parsed.message || 'Mohon konsultasi dengan dokter untuk evaluasi lebih lanjut.',
          needsDoctor: parsed.needsDoctor !== false, // Default true
          estimatedConsultationTime: parsed.estimatedConsultationTime || 10,
          symptoms_analysis: parsed.symptoms_analysis || {},
          raw_response: aiResponse
        };
      } else {
        throw new Error('No valid JSON found in AI response');
      }
    } catch (error) {
      console.error('❌ Error parsing AI response:', error);
      
      // Extract key info from text response
      return this.extractFromTextResponse(aiResponse);
    }
  }

  extractFromTextResponse(textResponse) {
    const text = textResponse.toLowerCase();
    
    let severity = 'MEDIUM';
    let needsDoctor = true;
    let recommendation = 'DOCTOR_CONSULTATION';

    // Emergency detection
    if (text.includes('darurat') || text.includes('emergency') || text.includes('segera')) {
      severity = 'HIGH';
      recommendation = 'EMERGENCY';
    }
    // Low severity detection
    else if (text.includes('ringan') || text.includes('normal') || text.includes('tidak perlu khawatir')) {
      severity = 'LOW';
      needsDoctor = false;
      recommendation = 'SELF_CARE';
    }

    return {
      severity,
      confidence: 0.6,
      recommendation,
      message: textResponse,
      needsDoctor,
      estimatedConsultationTime: severity === 'HIGH' ? 5 : 10,
      symptoms_analysis: {},
      raw_response: textResponse
    };
  }

  fallbackAnalysis(symptoms) {
    console.log('🔄 Using fallback rule-based analysis');
    
    const symptomText = Array.isArray(symptoms) 
      ? symptoms.join(' ').toLowerCase() 
      : symptoms.toLowerCase();

    // Emergency keywords
    const emergencyKeywords = ['kejang', 'sesak berat', 'nyeri dada', 'pingsan', 'perdarahan hebat'];
    const urgentKeywords = ['demam tinggi', 'muntah terus', 'sakit perut', 'sesak napas'];
    const normalKeywords = ['batuk', 'pilek', 'sakit kepala ringan', 'pusing'];

    if (emergencyKeywords.some(keyword => symptomText.includes(keyword))) {
      return {
        severity: 'HIGH',
        confidence: 0.8,
        recommendation: 'EMERGENCY',
        message: 'Gejala menunjukkan kondisi darurat. Segera ke IGD!',
        needsDoctor: false, // Skip consultation, direct to emergency
        estimatedConsultationTime: 0,
        symptoms_analysis: {
          red_flags: emergencyKeywords.filter(k => symptomText.includes(k))
        }
      };
    }

    if (urgentKeywords.some(keyword => symptomText.includes(keyword))) {
      return {
        severity: 'MEDIUM',
        confidence: 0.7,
        recommendation: 'DOCTOR_CONSULTATION',
        message: 'Gejala memerlukan konsultasi dokter hari ini.',
        needsDoctor: true,
        estimatedConsultationTime: 10,
        symptoms_analysis: {
          primary_symptoms: urgentKeywords.filter(k => symptomText.includes(k))
        }
      };
    }

    if (normalKeywords.some(keyword => symptomText.includes(keyword))) {
      return {
        severity: 'LOW',
        confidence: 0.6,
        recommendation: 'DOCTOR_CONSULTATION',
        message: 'Gejala ringan, konsultasi dokter untuk memastikan kondisi.',
        needsDoctor: true,
        estimatedConsultationTime: 5,
        symptoms_analysis: {
          primary_symptoms: normalKeywords.filter(k => symptomText.includes(k))
        }
      };
    }

    // Default
    return {
      severity: 'MEDIUM',
      confidence: 0.5,
      recommendation: 'DOCTOR_CONSULTATION',
      message: 'Perlu konsultasi dokter untuk evaluasi lebih lanjut.',
      needsDoctor: true,
      estimatedConsultationTime: 8,
      symptoms_analysis: {}
    };
  }

  // Generate follow-up questions based on symptoms
  generateFollowUpQuestion(symptoms, chatHistory = []) {
    const questionBank = [
      "Sudah berapa lama Anda merasakan keluhan ini?",
      "Pada skala 1-10, seberapa mengganggu keluhan ini?",
      "Apakah ada faktor yang membuat keluhan membaik atau memburuk?",
      "Apakah Anda sedang mengonsumsi obat-obatan tertentu?",
      "Apakah ada riwayat penyakit serupa dalam keluarga?",
      "Bagaimana pola makan dan istirahat Anda belakangan ini?"
    ];

    // Simple logic to pick relevant question
    const askedCount = chatHistory.filter(msg => !msg.isUser).length;
    
    if (askedCount < questionBank.length) {
      return questionBank[askedCount];
    }

    return "Adakah informasi tambahan yang ingin Anda sampaikan?";
  }
}

module.exports = new AIService();