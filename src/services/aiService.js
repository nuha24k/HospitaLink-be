// Update: HospitaLink-be/src/services/aiService.js
const axios = require('axios');

class AIService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.serpApiKey = process.env.SERP_API_KEY; // Add to .env
    this.baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.model = 'deepseek/deepseek-chat-v3.1:free';
    this.maxQuestions = 5; // Maximum follow-up questions
  }

  async analyzeSymptoms(symptoms, chatHistory = [], questionCount = 0) {
  try {
    console.log('🤖 AI analyzing symptoms:', symptoms, 'Question count:', questionCount);

    // If we haven't asked enough questions, generate follow-up
    if (questionCount < this.maxQuestions) {
      const followUpQuestion = await this.generateIntelligentFollowUp(symptoms, chatHistory, questionCount);
      
      if (followUpQuestion) {
        return {
          type: 'FOLLOW_UP_QUESTION',
          question: followUpQuestion,
          questionNumber: questionCount + 1,
          totalQuestions: this.maxQuestions,
          severity: 'COLLECTING_INFO',
          confidence: 0.3 + (questionCount * 0.1),
          needsMoreInfo: true
        };
      }
    }

    // After 5 questions - do final analysis with medical search
    console.log('🔍 Performing final medical analysis...');
    const aiAnalysis = await this.performFinalAnalysis(symptoms, chatHistory);
    
    // Always try to enhance with medical search results
    console.log('🔍 Searching for medical research...');
    const medicalInfo = await this.searchMedicalInformation(symptoms, aiAnalysis.possibleConditions || []);
    
    const finalResult = {
      ...aiAnalysis,
      medicalResearch: medicalInfo,
      type: 'FINAL_DIAGNOSIS',
      isComplete: true
    };

    console.log('✅ Final analysis with medical research completed');
    
    return finalResult;

  } catch (error) {
    console.error('❌ AI Service Error:', error.response?.data || error.message);
    return this.fallbackAnalysis(symptoms);
  }
}

  async generateIntelligentFollowUp(symptoms, chatHistory, questionCount) {
  try {
    const prompt = this.buildFollowUpPrompt(symptoms, chatHistory, questionCount);
    
    console.log('🤖 Generating follow-up question #', questionCount + 1);
    
    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getFollowUpSystemPrompt()
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 150, // Reduced for more focused questions
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
    const question = this.extractQuestionFromResponse(aiResponse);
    
    console.log('✅ Generated question:', question);
    
    return question;

  } catch (error) {
    console.error('❌ Follow-up generation error:', error);
    return this.getFallbackQuestion(questionCount);
  }
}

  getFollowUpSystemPrompt() {
    return `Anda adalah dokter AI yang sedang melakukan anamnesis (wawancara medis) dengan pasien.

TUGAS ANDA:
- Ajukan 1 pertanyaan follow-up yang relevan dan spesifik
- Pertanyaan harus natural dan seperti dokter sungguhan
- Fokus pada informasi yang belum ditanyakan
- Gunakan bahasa Indonesia yang hangat dan profesional

AREA PERTANYAAN YANG PERLU DIGALI:
1. Durasi dan onset gejala
2. Intensitas dan karakteristik gejala
3. Faktor pencetus dan yang memperbaik/memperburuk
4. Gejala penyerta
5. Riwayat medis dan pengobatan

CONTOH GAYA PERTANYAAN:
❌ "Apakah Anda demam?" (terlalu sederhana)
✅ "Sejak kapan demam ini Anda rasakan? Apakah demamnya naik turun atau terus menerus?"

❌ "Bagaimana sakitnya?" (terlalu umum)
✅ "Untuk sakit perutnya, apakah rasanya seperti ditusuk, melilit, atau perih? Dan apakah sakitnya menjalar ke bagian lain?"

FORMAT RESPONSE:
Berikan HANYA pertanyaan tanpa penjelasan tambahan.`;
  }

  buildFollowUpPrompt(symptoms, chatHistory, questionCount) {
    let prompt = `INFORMASI PASIEN:\n`;
    prompt += `Gejala awal: ${Array.isArray(symptoms) ? symptoms.join(', ') : symptoms}\n\n`;
    
    if (chatHistory && chatHistory.length > 0) {
      prompt += `RIWAYAT PERCAKAPAN:\n`;
      chatHistory.forEach((msg, index) => {
        prompt += `${msg.isUser ? 'Pasien' : 'Dokter'}: ${msg.text}\n`;
      });
      prompt += `\n`;
    }

    prompt += `INSTRUKSI:\n`;
    prompt += `Ini adalah pertanyaan ke-${questionCount + 1} dari maksimal ${this.maxQuestions} pertanyaan.\n`;
    prompt += `Buatkan 1 pertanyaan follow-up yang paling relevan untuk melengkapi informasi diagnosis.\n`;
    prompt += `Pertanyaan harus spesifik dan belum ditanyakan sebelumnya.`;

    return prompt;
  }

  async performFinalAnalysis(symptoms, chatHistory) {
  try {
    const prompt = this.buildFinalAnalysisPrompt(symptoms, chatHistory);
    
    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getFinalAnalysisSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
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
    const parsedResult = this.parseFinalAnalysis(aiResponse);
    
    // Ensure medical research is always attempted
    console.log('🔍 Attempting to enhance with medical research...');
    
    return parsedResult;

  } catch (error) {
    console.error('❌ Final analysis error:', error);
    return this.fallbackAnalysis(symptoms);
  }
}

  getFinalAnalysisSystemPrompt() {
    return `Anda adalah AI dokter yang memberikan analisis medis berdasarkan anamnesis lengkap.

TUGAS ANDA:
1. Analisis semua informasi yang terkumpul
2. Berikan kemungkinan diagnosis (differential diagnosis)
3. Tentukan tingkat keparahan dan urgensi
4. Berikan rekomendasi tindakan

ATURAN PENTING:
- JANGAN memberikan diagnosis pasti
- Gunakan istilah "kemungkinan" atau "indikasi"
- Selalu sarankan konfirmasi dengan dokter
- Prioritaskan keselamatan pasien

FORMAT RESPONSE (JSON):
{
  "severity": "LOW|MEDIUM|HIGH",
  "confidence": 0.85,
  "recommendation": "SELF_CARE|DOCTOR_CONSULTATION|EMERGENCY",
  "possibleConditions": ["Kondisi 1", "Kondisi 2"],
  "primaryDiagnosis": "Kemungkinan diagnosis utama",
  "explanation": "Penjelasan dalam bahasa Indonesia",
  "needsDoctor": true/false,
  "urgencyLevel": "TIDAK_MENDESAK|DALAM_24_JAM|SEGERA|DARURAT",
  "recommendedActions": ["Aksi 1", "Aksi 2"],
  "redFlags": ["Red flag 1", "Red flag 2"],
  "whenToSeekHelp": "Kapan harus ke dokter",
  "estimatedConsultationTime": 5-30
}`;
  }

  buildFinalAnalysisPrompt(symptoms, chatHistory) {
    let prompt = `ANALISIS MEDIS LENGKAP\n\n`;
    
    prompt += `GEJALA UTAMA:\n${Array.isArray(symptoms) ? symptoms.join(', ') : symptoms}\n\n`;
    
    if (chatHistory && chatHistory.length > 0) {
      prompt += `HASIL ANAMNESIS LENGKAP:\n`;
      chatHistory.forEach((msg, index) => {
        prompt += `${msg.isUser ? 'Pasien' : 'Dokter'}: ${msg.text}\n`;
      });
      prompt += `\n`;
    }

    prompt += `INSTRUKSI:\n`;
    prompt += `Berdasarkan informasi lengkap di atas, berikan analisis medis komprehensif dalam format JSON yang telah ditentukan.`;
    prompt += `Fokus pada differential diagnosis yang paling mungkin dan prioritaskan keselamatan pasien.`;

    return prompt;
  }

  async searchMedicalInformation(symptoms, possibleConditions) {
    try {
      if (!this.serpApiKey) {
        console.log('⚠️ SERP API key not configured, skipping medical search');
        return null;
      }

      // Prepare search queries
      const searchQueries = [
        `${symptoms.join(' ')} gejala penyebab medis`,
        `${possibleConditions.join(' OR ')} kondisi medis treatment`,
        `diferensial diagnosis ${symptoms.join(' ')}`
      ];

      const searchResults = [];

      for (const query of searchQueries.slice(0, 2)) { // Limit to 2 searches
        try {
          console.log('🔍 Searching medical info:', query);
          
          const response = await axios.get('https://serpapi.com/search', {
            params: {
              api_key: this.serpApiKey,
              engine: 'google',
              q: query,
              hl: 'id',
              gl: 'id',
              num: 5
            },
            timeout: 5000
          });

          if (response.data.organic_results) {
            const relevantResults = response.data.organic_results
              .filter(result => this.isRelevantMedicalSource(result.link))
              .slice(0, 3)
              .map(result => ({
                title: result.title,
                snippet: result.snippet,
                link: result.link,
                source: this.extractSourceName(result.link)
              }));
            
            searchResults.push(...relevantResults);
          }
        } catch (searchError) {
          console.error('❌ Search error for query:', query, searchError.message);
        }
      }

      return {
        searchPerformed: true,
        totalResults: searchResults.length,
        results: searchResults,
        disclaimer: "Informasi dari sumber medis online sebagai referensi tambahan. Konsultasi dengan dokter tetap diperlukan untuk diagnosis yang akurat."
      };

    } catch (error) {
      console.error('❌ Medical search error:', error);
      return {
        searchPerformed: false,
        error: 'Medical information search unavailable',
        disclaimer: "Pencarian informasi medis tidak tersedia saat ini."
      };
    }
  }

  isRelevantMedicalSource(url) {
    const trustedDomains = [
      'halodoc.com',
      'alodokter.com', 
      'klikdokter.com',
      'honestdocs.id',
      'mayoclinic.org',
      'webmd.com',
      'healthline.com',
      'medicalnewstoday.com',
      'who.int',
      'cdc.gov',
      'nih.gov',
      'kemkes.go.id'
    ];

    return trustedDomains.some(domain => url.includes(domain));
  }

  extractSourceName(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '').split('.')[0];
    } catch {
      return 'Medical Source';
    }
  }

  extractQuestionFromResponse(aiResponse) {
  // Clean up response
  const cleanResponse = aiResponse.trim();
  
  // Look for question patterns
  const lines = cleanResponse.split('\n').filter(line => line.trim());
  
  // Find the best question line
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.includes('?') && 
        trimmedLine.length > 15 && 
        trimmedLine.length < 250 &&
        !trimmedLine.toLowerCase().includes('sistem') &&
        !trimmedLine.toLowerCase().includes('format')) {
      return trimmedLine;
    }
  }

  // If no good question found, take the longest substantial line with ?
  const questionLines = lines.filter(line => 
    line.includes('?') && 
    line.length > 20 && 
    line.length < 200
  );
  
  if (questionLines.length > 0) {
    return questionLines[0].trim();
  }

  // Last resort: take first substantial line and make it a question
  const substantialLine = lines.find(line => line.length > 20);
  if (substantialLine && !substantialLine.includes('?')) {
    return substantialLine.trim() + '?';
  }

  return null;
}

// Better fallback questions
getFallbackQuestion(questionCount) {
  const fallbackQuestions = [
    "Sejak kapan Anda merasakan gejala ini? Apakah muncul secara tiba-tiba atau bertahap?",
    "Pada skala 1-10, seberapa mengganggu gejala ini terhadap aktivitas sehari-hari Anda?",
    "Apakah ada hal tertentu yang membuat gejala membaik atau justru memburuk?",
    "Apakah Anda mengalami gejala penyerta lainnya seperti demam, mual, atau pusing?",
    "Apakah Anda memiliki riwayat penyakit atau sedang mengonsumsi obat-obatan tertentu?"
  ];

  const question = fallbackQuestions[questionCount] || 
    "Adakah informasi penting lainnya yang perlu saya ketahui tentang kondisi Anda?";
    
  console.log('🔄 Using fallback question:', question);
  return question;
}

  parseFinalAnalysis(aiResponse) {
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          severity: parsed.severity || 'MEDIUM',
          confidence: parsed.confidence || 0.7,
          recommendation: parsed.recommendation || 'DOCTOR_CONSULTATION',
          possibleConditions: parsed.possibleConditions || [],
          primaryDiagnosis: parsed.primaryDiagnosis || 'Memerlukan evaluasi lebih lanjut',
          explanation: parsed.explanation || 'Berdasarkan gejala yang Anda sampaikan, disarankan untuk berkonsultasi dengan dokter.',
          needsDoctor: parsed.needsDoctor !== false,
          urgencyLevel: parsed.urgencyLevel || 'DALAM_24_JAM',
          recommendedActions: parsed.recommendedActions || [],
          redFlags: parsed.redFlags || [],
          whenToSeekHelp: parsed.whenToSeekHelp || 'Segera konsultasi dengan dokter',
          estimatedConsultationTime: parsed.estimatedConsultationTime || 10,
          raw_response: aiResponse
        };
      } else {
        throw new Error('No valid JSON found in AI response');
      }
    } catch (error) {
      console.error('❌ Error parsing final analysis:', error);
      return this.extractFromTextResponse(aiResponse);
    }
  }

  // Keep existing methods: extractFromTextResponse, fallbackAnalysis, etc.
  extractFromTextResponse(textResponse) {
    const text = textResponse.toLowerCase();
    
    let severity = 'MEDIUM';
    let needsDoctor = true;
    let recommendation = 'DOCTOR_CONSULTATION';

    if (text.includes('darurat') || text.includes('emergency') || text.includes('segera')) {
      severity = 'HIGH';
      recommendation = 'EMERGENCY';
    } else if (text.includes('ringan') || text.includes('normal') || text.includes('tidak perlu khawatir')) {
      severity = 'LOW';
      needsDoctor = false;
      recommendation = 'SELF_CARE';
    }

    return {
      severity,
      confidence: 0.6,
      recommendation,
      explanation: textResponse,
      needsDoctor,
      estimatedConsultationTime: severity === 'HIGH' ? 5 : 10,
      possibleConditions: [],
      primaryDiagnosis: 'Memerlukan evaluasi dokter',
      raw_response: textResponse
    };
  }

  fallbackAnalysis(symptoms) {
    console.log('🔄 Using fallback rule-based analysis');
    
    const symptomText = Array.isArray(symptoms) 
      ? symptoms.join(' ').toLowerCase() 
      : symptoms.toLowerCase();

    const emergencyKeywords = ['kejang', 'sesak berat', 'nyeri dada', 'pingsan', 'perdarahan hebat'];
    const urgentKeywords = ['demam tinggi', 'muntah terus', 'sakit perut', 'sesak napas'];
    const normalKeywords = ['batuk', 'pilek', 'sakit kepala ringan', 'pusing'];

    if (emergencyKeywords.some(keyword => symptomText.includes(keyword))) {
      return {
        severity: 'HIGH',
        confidence: 0.8,
        recommendation: 'EMERGENCY',
        explanation: 'Gejala menunjukkan kondisi darurat. Segera ke IGD!',
        needsDoctor: false,
        urgencyLevel: 'DARURAT',
        possibleConditions: ['Kondisi darurat medis'],
        primaryDiagnosis: 'Kondisi darurat - memerlukan penanganan segera'
      };
    }

    return {
      severity: 'MEDIUM',
      confidence: 0.5,
      recommendation: 'DOCTOR_CONSULTATION',
      explanation: 'Berdasarkan gejala yang disampaikan, disarankan untuk berkonsultasi dengan dokter untuk evaluasi lebih lanjut.',
      needsDoctor: true,
      urgencyLevel: 'DALAM_24_JAM',
      possibleConditions: ['Memerlukan evaluasi medis'],
      primaryDiagnosis: 'Perlu evaluasi dokter untuk diagnosis yang tepat'
    };
  }
}

module.exports = new AIService();