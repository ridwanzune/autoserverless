import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_UPLOAD_PRESET } from '../constants';

/**
 * Uploads a base64 encoded image to Cloudinary using an unsigned upload preset.
 * @param base64Image The base64 data URL of the image to upload.
 * @returns A promise that resolves with the secure URL of the uploaded image.
 */
export const uploadToCloudinary = async (base64Image: string): Promise<string> => {
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    
    const formData = new FormData();
    formData.append('file', base64Image);
    formData.append('api_key', CLOUDINARY_API_KEY);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Cloudinary upload failed: ${errorData.error.message}`);
        }

        const data = await response.json();
        if (!data.secure_url) {
            throw new Error('Cloudinary response did not include a secure_url.');
        }
        
        return data.secure_url;

    } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        // Re-throw to be caught by the main task handler in App.tsx
        throw error;
    }
};
