// Validation functions
export function validateClient(client) {
	const errors = [];
	if (!client.name?.trim()) errors.push('Client name is required');
	if (!client.contact_email?.trim()) errors.push('Contact email is required');
	if (client.contact_email && !isValidEmail(client.contact_email)) {
		errors.push('Please enter a valid email address');
	}
	return errors;
}

export function validateProject(project) {
	const errors = [];
	if (!project.name?.trim()) errors.push('Project name is required');
	if (project.temperature < 0 || project.temperature > 2) {
		errors.push('Temperature must be between 0 and 2');
	}
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
	contact_phone: '022',
	location_country: '',
	location_city: '',
	notes: ''
};

export const defaultProject = {
	name: '',
	plan: 'free',
	addons: [],
	llm_model: 'gpt-4o-mini',
	temperature: 0.3,
	maxHistoryMessages: 4,
	system_prompt: '',
	status: 'active'
}; 