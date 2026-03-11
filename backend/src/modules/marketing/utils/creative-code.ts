import { prisma } from '../../../db';

interface CodeSegmentValue {
  code: string;
  label: string;
}

interface CodeSegment {
  name: string;
  order: number;
  values: CodeSegmentValue[];
}

interface CodeConfig {
  segments: CodeSegment[];
  separator: string;
  seqDigits: number;
}

/**
 * Generates a creative code like "1-2-3-001"
 * Segments are configurable from CreativeCodeConfig
 */
export async function generateCreativeCode(
  segmentSelections: Record<string, string> // { "Language": "1", "Project": "2", "Product": "3" }
): Promise<string> {
  const configRow = await prisma.creativeCodeConfig.findFirst();

  if (!configRow) {
    throw new Error('Creative code config not found. Please set up creative code configuration.');
  }

  const config: CodeConfig = {
    segments: configRow.segments as unknown as CodeSegment[],
    separator: configRow.separator,
    seqDigits: configRow.seqDigits,
  };

  // Build prefix from selected segment values
  const sortedSegments = [...config.segments].sort((a, b) => a.order - b.order);
  const prefixParts: string[] = [];

  for (const seg of sortedSegments) {
    const selectedCode = segmentSelections[seg.name];
    if (!selectedCode) {
      throw new Error(`Missing segment selection for "${seg.name}"`);
    }
    const valid = seg.values.find((v) => v.code === selectedCode);
    if (!valid) {
      throw new Error(`Invalid code "${selectedCode}" for segment "${seg.name}"`);
    }
    prefixParts.push(selectedCode);
  }

  const prefix = prefixParts.join(config.separator);

  // Find the next sequence number for this prefix
  const lastCreative = await prisma.creative.findFirst({
    where: { code: { startsWith: prefix + config.separator } },
    orderBy: { code: 'desc' },
  });

  let seq = 1;
  if (lastCreative) {
    const lastSeq = lastCreative.code.split(config.separator).pop();
    if (lastSeq) {
      seq = parseInt(lastSeq, 10) + 1;
    }
  }

  const seqStr = String(seq).padStart(config.seqDigits, '0');
  return `${prefix}${config.separator}${seqStr}`;
}
