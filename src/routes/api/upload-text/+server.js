import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PDFExtract } from 'pdf.js-extract';
import { env } from '$env/dynamic/private';

// LangChain imports
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';

async function extractPdfText(buffer) {
	const pdfExtract = new PDFExtract();
	return new Promise((resolve, reject) => {
		pdfExtract.extractBuffer(buffer, {}, (err, data) => {
			if (err) return reject(err);
			const text = data.pages
				.map((page) => page.content.map((item) => item.str).join(' '))
				.join('\n');
			resolve(text);
		});
	});
}

// Initialize embeddings based on model
function getEmbeddings(embeddingModel) {
	// Check if it's a Hugging Face model (contains 'sentence-transformers' or other HF patterns)
	if (embeddingModel.includes('sentence-transformers/') || embeddingModel.includes('huggingface.co/')) {
		return new HuggingFaceTransformersEmbeddings({
			modelName: embeddingModel,
			stripNewLines: true
		});
	} else {
		// Default to OpenAI embeddings with explicit API key
		if (!env.OPENAI_API_KEY) {
			throw new Error('OPENAI_API_KEY environment variable is not set. Please configure your OpenAI API key.');
		}
		
		return new OpenAIEmbeddings({
			model: embeddingModel,
			stripNewLines: true,
			openAIApiKey: env.OPENAI_API_KEY
		});
	}
}

// Custom semantic chunking implementation
async function semanticChunking(text, embeddings, thresholdType, thresholdAmount, minChunkSize = 100, maxChunkSize = 4000) {
	console.log(`Starting semantic chunking with ${thresholdType} method, threshold: ${thresholdAmount}`);
	
	// First, split text into small segments (sentences or paragraphs)
	const initialSplitter = new RecursiveCharacterTextSplitter({
		chunkSize: 100,
		chunkOverlap: 50,
		separators: ['\n\n', '\n', '. ', '! ', '? ', ' ', '']
	});
	
	const segments = await initialSplitter.splitText(text);
	console.log(`Initial segmentation created ${segments.length} segments`);
	
	if (segments.length <= 1) {
		console.log('Only one segment found, returning as-is');
		return segments;
	}
	
	// Get embeddings for all segments
	console.log('Generating embeddings for segments...');
	const segmentEmbeddings = await embeddings.embedDocuments(segments);
	
	// Calculate distances between consecutive segments
	const distances = [];
	for (let i = 0; i < segmentEmbeddings.length - 1; i++) {
		const distance = cosineDistance(segmentEmbeddings[i], segmentEmbeddings[i + 1]);
		distances.push(distance);
	}
	
	console.log(`Calculated ${distances.length} distances, range: ${Math.min(...distances).toFixed(4)} - ${Math.max(...distances).toFixed(4)}`);
	
	// Calculate threshold based on method
	let threshold;
	switch (thresholdType) {
		case 'percentile':
			threshold = calculatePercentile(distances, thresholdAmount);
			break;
		case 'standard_deviation':
			threshold = calculateStandardDeviationThreshold(distances, thresholdAmount);
			break;
		case 'interquartile':
			threshold = calculateInterquartileThreshold(distances, thresholdAmount);
			break;
		case 'gradient':
			threshold = calculateGradientThreshold(distances, thresholdAmount);
			break;
		default:
			threshold = calculatePercentile(distances, 95.0);
	}
	
	console.log(`Calculated threshold: ${threshold.toFixed(4)} using ${thresholdType} method`);
	
	// Find breakpoints where distance exceeds threshold
	const breakpoints = [];
	for (let i = 0; i < distances.length; i++) {
		if (distances[i] > threshold) {
			breakpoints.push(i + 1); // +1 because we want to split after segment i
		}
	}
	
	console.log(`Found ${breakpoints.length} breakpoints`);
	
	// Create chunks based on breakpoints
	const chunks = [];
	let startIndex = 0;
	
	for (const breakpoint of breakpoints) {
		const chunk = segments.slice(startIndex, breakpoint).join(' ').trim();
		if (chunk.length >= minChunkSize && chunk.length <= maxChunkSize) {
			chunks.push(chunk);
		}
		startIndex = breakpoint;
	}
	
	// Add the last chunk
	const lastChunk = segments.slice(startIndex).join(' ').trim();
	if (lastChunk.length >= minChunkSize && lastChunk.length <= maxChunkSize) {
		chunks.push(lastChunk);
	}
	
	console.log(`Created ${chunks.length} semantic chunks`);
	
	// If no chunks were created, fall back to simple splitting
	if (chunks.length === 0) {
		console.log('No chunks created, falling back to simple splitting');
		const fallbackSplitter = new RecursiveCharacterTextSplitter({
			chunkSize: 2000,
			chunkOverlap: 200
		});
		return await fallbackSplitter.splitText(text);
	}
	
	return chunks;
}

// Helper function to calculate cosine distance between two vectors
function cosineDistance(vec1, vec2) {
	const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
	const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
	const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
	const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);
	return 1 - cosineSimilarity; // Convert similarity to distance
}

// Calculate percentile threshold
function calculatePercentile(distances, percentile) {
	const sorted = [...distances].sort((a, b) => a - b);
	const index = Math.ceil((percentile / 100) * sorted.length) - 1;
	return sorted[Math.max(0, index)];
}

// Calculate standard deviation threshold
function calculateStandardDeviationThreshold(distances, multiplier) {
	const mean = distances.reduce((sum, val) => sum + val, 0) / distances.length;
	const variance = distances.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / distances.length;
	const stdDev = Math.sqrt(variance);
	return mean + (multiplier * stdDev);
}

// Calculate interquartile range threshold
function calculateInterquartileThreshold(distances, multiplier) {
	const sorted = [...distances].sort((a, b) => a - b);
	const q1Index = Math.floor(sorted.length * 0.25);
	const q3Index = Math.floor(sorted.length * 0.75);
	const q1 = sorted[q1Index];
	const q3 = sorted[q3Index];
	const iqr = q3 - q1;
	return q3 + (multiplier * iqr);
}

// Calculate gradient threshold
function calculateGradientThreshold(distances, percentile) {
	// Calculate gradients (differences between consecutive distances)
	const gradients = [];
	for (let i = 1; i < distances.length; i++) {
		gradients.push(Math.abs(distances[i] - distances[i - 1]));
	}
	
	// Use percentile of gradients as threshold
	return calculatePercentile(gradients, percentile);
}

export async function POST({ request }) {
	const authHeader = request.headers.get('authorization');
	const jwt = authHeader?.replace('Bearer ', '');
	if (!jwt) return json({ error: 'Unauthorized' }, { status: 401 });

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
		global: { headers: { Authorization: `Bearer ${jwt}` } },
		auth: { persistSession: false }
	});

	const {
		data: { user },
		error: userError
	} = await supabase.auth.getUser();
	if (userError || !user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { data: profile, error: profileError } = await supabase
		.from('profiles')
		.select('is_dev')
		.eq('id', user.id)
		.single();

	if (profileError)
		return json(
			{ error: 'Database error checking profile', detail: profileError.message },
			{ status: 500 }
		);
	if (!profile?.is_dev) return json({ error: 'Forbidden' }, { status: 403 });

	try {
		const formData = await request.formData();
		const file = formData.get('file');
		const projectId = formData.get('projectId');
		const chunkingMethod = formData.get('chunkingMethod') || 'fixed';
		const chunkSize = parseInt(formData.get('chunkSize') || '3200', 10);
		const chunkOverlap = parseInt(formData.get('chunkOverlap') || '200', 10);
		const embeddingModel = formData.get('embeddingModel') || 'text-embedding-3-small';
		const semanticThresholdType = formData.get('semanticThresholdType') || 'percentile';
		const semanticThresholdAmount = parseFloat(formData.get('semanticThresholdAmount') || '95.0');

		if (!file || !projectId) {
			return json({ error: 'Missing file or projectId' }, { status: 400 });
		}

		// Fetch project configuration (for validation only)
		const { data: project, error: projectError } = await supabase
			.from('projects')
			.select('id')
			.eq('id', projectId)
			.single();

		if (projectError || !project) {
			return json({ error: 'Project not found', detail: projectError?.message }, { status: 404 });
		}

		let text;
		if (file.type === 'application/pdf') {
			const buffer = Buffer.from(await file.arrayBuffer());
			text = await extractPdfText(buffer);
		} else if (
			file.type === 'text/plain' ||
			file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		) {
			text = await file.text();
		} else {
			return json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
		}

		const doc_name = file.name;

		if (!text) return json({ error: 'Could not extract text from file' }, { status: 400 });

		// Use LangChain text splitter
		let textSplitter;
		let chunks;
		console.log(chunkingMethod)
		
		switch (chunkingMethod) {
			case 'recursive':
				textSplitter = new RecursiveCharacterTextSplitter({
					chunkSize: chunkSize,
					chunkOverlap: chunkOverlap,
					separators: ['\n\n', '\n', ' ', '']
				});
				chunks = await textSplitter.splitText(text);
				break;
			case 'semantic':
				console.log("Semantic chhunking")
				// Use custom semantic chunking
				const embeddings = getEmbeddings(embeddingModel);
				chunks = await semanticChunking(
					text, 
					embeddings, 
					semanticThresholdType, 
					semanticThresholdAmount,
					100, // minChunkSize
					4000 // maxChunkSize
				);
				break;
			default: // fixed
				textSplitter = new RecursiveCharacterTextSplitter({
					chunkSize: chunkSize,
					chunkOverlap: chunkOverlap
				});
				chunks = await textSplitter.splitText(text);
		}

		// Initialize embeddings (only if not already done for semantic chunking)
		let embeddings;
		if (chunkingMethod === 'semantic') {
			// Embeddings already initialized for semantic chunking
			embeddings = getEmbeddings(embeddingModel);
		} else {
			embeddings = getEmbeddings(embeddingModel);
		}

		// Generate embeddings in batches
		const rows = [];
		const batchSize = 100;
		
		// Document configuration to store in config JSONB
		const documentConfig = {
			embedding_model: embeddingModel,
			chunking_method: chunkingMethod,
			uploaded_at: new Date().toISOString()
		};

		// Only include chunk parameters if they're relevant
		if (chunkingMethod !== 'semantic') {
			documentConfig.chunk_size = chunkSize;
			documentConfig.chunk_overlap = chunkOverlap;
		} else {
			// Include semantic chunking parameters
			documentConfig.semantic_threshold_type = semanticThresholdType;
			documentConfig.semantic_threshold_amount = semanticThresholdAmount;
		}

		for (let i = 0; i < chunks.length; i += batchSize) {
			const batch = chunks.slice(i, i + batchSize);
			const batchEmbeddings = await embeddings.embedDocuments(batch);
			
			batchEmbeddings.forEach((embedding, j) => {
				rows.push({
					project_id: projectId,
					doc_name,
					chunk_index: i + j,
					content: batch[j],
					embedding: embedding,
					config: documentConfig // Store document-specific config
				});
			});
		}

		// Insert documents into database
		const { data, error } = await supabase
			.from('documents')
			.insert(rows)
			.select('id, doc_name, chunk_index, content, embedding, config');

		if (error) {
			console.error('Error inserting documents:', error);
			return json({ error: 'Failed to save documents' }, { status: 500 });
		}

		return json({ 
			success: true, 
			message: `Successfully processed ${chunks.length} chunks from ${doc_name}`,
			document: {
				name: doc_name,
				chunks: chunks.length,
				config: documentConfig
			}
		});
	} catch (err) {
		console.error(err);
		return json({ error: 'Server error', detail: err.message }, { status: 500 });
	}
}
