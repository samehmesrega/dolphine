import { prisma } from '../../../db';
import * as scriptService from './script.service';

const SYSTEM_PROMPT = `You are a professional video ad script writer for e-commerce brands.
You create detailed video scripts with scene-by-scene breakdowns.

For each scene provide:
- Scene number and duration (seconds)
- Visual description (what the viewer sees)
- Camera angle (close-up, wide, overhead, etc.)
- Setting (studio, outdoor, lifestyle, etc.)
- Text overlay (if any)
- Voiceover script (if any)

The script should be optimized for the specified platform:
- Meta/Instagram: 15-30 seconds, hook in first 3 seconds
- TikTok: 15-60 seconds, native/authentic feel
- Snapchat: 6-10 seconds, vertical, fast-paced

Write in the specified language (Arabic or English).
Make it conversion-focused with clear CTA.

Respond ONLY with valid JSON in this exact format:
{
  "title": "script title",
  "totalDuration": 25,
  "scenes": [
    {
      "order": 1,
      "durationSec": 3,
      "description": "shot description",
      "cameraAngle": "close-up",
      "setting": "lifestyle home",
      "textOverlay": "text on screen or null",
      "voiceover": "voiceover script or null"
    }
  ]
}`;

interface GenerateScriptInput {
  projectId: string;
  platform: string;
  audience?: string;
  language?: string;
  ideaId?: string;
  productName?: string;
  productDescription?: string;
  additionalNotes?: string;
}

interface AIScriptResponse {
  title: string;
  totalDuration: number;
  scenes: {
    order: number;
    durationSec: number;
    description: string;
    cameraAngle?: string;
    setting?: string;
    textOverlay?: string | null;
    voiceover?: string | null;
  }[];
}

export async function generateScript(input: GenerateScriptInput) {
  const { projectId, platform, audience, language = 'ar', ideaId, productName, productDescription, additionalNotes } = input;

  // Gather context
  const project = await prisma.mktProject.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');

  let ideaContext = '';
  if (ideaId) {
    const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
    if (idea) {
      ideaContext = `\nIdea: ${idea.title} - ${idea.description}`;
    }
  }

  const userPrompt = `
Product: ${productName || 'General'} ${productDescription ? `- ${productDescription}` : ''}
Store: ${project.name}
Platform: ${platform}
Target Audience: ${audience || 'General audience'}
Language: ${language === 'ar' ? 'Arabic' : 'English'}${ideaContext}
${additionalNotes ? `\nAdditional Notes: ${additionalNotes}` : ''}

Generate a detailed video script.`;

  // Call OpenAI
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errBody}`);
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI');

  const parsed: AIScriptResponse = JSON.parse(content);

  // Save the script to the database
  const script = await scriptService.createScript({
    title: parsed.title,
    projectId,
    platform,
    audience,
    language,
    ideaId,
    scenes: parsed.scenes.map((s) => ({
      order: s.order,
      description: s.description,
      cameraAngle: s.cameraAngle || undefined,
      setting: s.setting || undefined,
      textOverlay: s.textOverlay || undefined,
      voiceover: s.voiceover || undefined,
      durationSec: s.durationSec || undefined,
    })),
  });

  // Save initial version
  await scriptService.createScriptVersion(script.id);

  return script;
}
