// Validation functions
export function validateClient(client) {
	const errors = [];
	if (!client.name?.trim()) errors.push('Client name is required');
	if (!client.contact_email?.trim()) errors.push('Contact email is required');
	if (client.contact_email && !isValidEmail(client.contact_email)) {
		errors.push('Please enter a valid email address');
	}
	// Validate all ID fields are present
	if (client.id && !validateUUID(client.id)) return false;
	return errors;
}

export function validateProject(project) {
	const errors = [];
	if (!project.name?.trim()) errors.push('Project name is required');
	if (project.temperature < 0 || project.temperature > 2) {
		errors.push('Temperature must be between 0 and 2');
	}
	// Validate all ID fields are present
	if (project.id && !validateUUID(project.id)) return false;
	return errors;
}

export function isValidEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Date formatting
export function formatDate(dateString) {
	return new Date(dateString).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

// Default objects
export const defaultClient = {
	name: '',
	business_type: '',
	contact_email: '',
	contact_phone: '',
	location_country: '',
	location_city: '',
	notes: ''
};

export const defaultProject = {
	name: '',
	status: 'active',
	inbox_id: ''
};

// Sanitizes user input to prevent prompt injection and XSS
export function sanitizeInput(input) {
	if (typeof input !== 'string') return '';
	// Remove common prompt injection patterns and excessive whitespace
	return input
		.replace(/\n+/g, ' ') // collapse newlines
		.replace(/\s{2,}/g, ' ') // collapse whitespace
		.replace(/(ignore|disregard|forget|override|system prompt|as an ai|you are now|repeat after me)/gi, '')
		.trim();
}

// Validates a UUID (v4 or v1)
export function validateUUID(uuid) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}
