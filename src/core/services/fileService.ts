import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import Database from '@tauri-apps/plugin-sql';

export interface AssetInfo {
    id: string;
    file_path: string;
    file_name: string;
    file_type: string;
    file_size: number;
    mime_type: string | null;
}

export interface Asset extends AssetInfo {
    page_id: string | null;
}

/**
 * Upload a file using file picker
 */
export async function uploadFileFromPicker(
    pageId?: string
): Promise<AssetInfo | null> {
    // Open file picker
    const selected = await open({
        multiple: false,
        filters: [
            {
                name: 'All Files',
                extensions: ['*'],
            },
            {
                name: 'Images',
                extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
            },
            {
                name: 'Videos',
                extensions: ['mp4', 'webm', 'mov'],
            },
            {
                name: 'PDFs',
                extensions: ['pdf'],
            },
        ],
    });
    
    if (!selected || Array.isArray(selected)) {
        return null;
    }
    
    // Upload the selected file
    const assetInfo = await invoke<AssetInfo>('upload_file', {
        filePath: selected,
        pageId: pageId || null,
    });
    
    // Store in database
    const db = await Database.load('sqlite:omni_workspace.db');
    await db.execute(
        'INSERT INTO assets (id, page_id, file_path, file_name, file_type, file_size, mime_type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
            assetInfo.id,
            pageId || null,
            assetInfo.file_path,
            assetInfo.file_name,
            assetInfo.file_type,
            assetInfo.file_size,
            assetInfo.mime_type || null,
        ]
    );
    
    return assetInfo;
}

/**
 * Upload a file from a File object (for drag & drop)
 * Note: This requires the file to be saved to disk first via a different method
 * For now, drag & drop will need to save files differently
 */
export async function uploadFileFromPath(
    filePath: string,
    pageId?: string
): Promise<AssetInfo> {
    const assetInfo = await invoke<AssetInfo>('upload_file', {
        filePath,
        pageId: pageId || null,
    });
    
    // Store in database
    const db = await Database.load('sqlite:omni_workspace.db');
    await db.execute(
        'INSERT INTO assets (id, page_id, file_path, file_name, file_type, file_size, mime_type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
            assetInfo.id,
            pageId || null,
            assetInfo.file_path,
            assetInfo.file_name,
            assetInfo.file_type,
            assetInfo.file_size,
            assetInfo.mime_type || null,
        ]
    );
    
    return assetInfo;
}

/**
 * Upload a file from raw bytes (for paste/drag-drop)
 */
export async function uploadFileFromBytes(
    bytes: ArrayBuffer,
    fileName: string,
    extension: string,
    pageId?: string
): Promise<AssetInfo> {
    // Convert ArrayBuffer to number[] for Tauri invoke
    const byteArray = new Uint8Array(bytes);
    const byteList = Array.from(byteArray);

    const assetInfo = await invoke<AssetInfo>('upload_asset_bytes', {
        bytes: byteList,
        fileName,
        extension,
        pageId: pageId || null,
    });
    
    // Store in database
    const db = await Database.load('sqlite:omni_workspace.db');
    await db.execute(
        'INSERT INTO assets (id, page_id, file_path, file_name, file_type, file_size, mime_type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
            assetInfo.id,
            pageId || null,
            assetInfo.file_path,
            assetInfo.file_name,
            assetInfo.file_type,
            assetInfo.file_size,
            assetInfo.mime_type || null,
        ]
    );
    
    return assetInfo;
}

/**
 * Get the URL for an asset to display it
 * Returns a blob URL that can be used in img/video/iframe tags
 */
export async function getAssetUrl(filePath: string): Promise<string> {
    try {
        // Read file as bytes from Tauri
        const bytes = await invoke<number[]>('read_asset_file', { filePath });
        
        // Convert to Uint8Array
        const uint8Array = new Uint8Array(bytes);
        
        // Get mime type from file extension
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        let mimeType = 'application/octet-stream';
        if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
        else if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'gif') mimeType = 'image/gif';
        else if (ext === 'webp') mimeType = 'image/webp';
        else if (ext === 'mp4') mimeType = 'video/mp4';
        else if (ext === 'webm') mimeType = 'video/webm';
        else if (ext === 'pdf') mimeType = 'application/pdf';
        
        // Create blob URL
        const blob = new Blob([uint8Array], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        
        return blobUrl;
    } catch (error) {
        console.error('Failed to load asset:', error);
        // Fallback to file:// URL (may not work in browser)
        return await invoke<string>('get_asset_url', { filePath });
    }
}

/**
 * Delete an asset file and remove from database
 */
export async function deleteAsset(assetId: string, filePath: string): Promise<void> {
    // Delete file via Tauri
    await invoke('delete_asset_file', { filePath });
    
    // Delete from database
    const db = await Database.load('sqlite:omni_workspace.db');
    await db.execute('DELETE FROM assets WHERE id = $1', [assetId]);
}

/**
 * Get asset by ID
 */
export async function getAsset(assetId: string): Promise<Asset | null> {
    const db = await Database.load('sqlite:omni_workspace.db');
    const rows = await db.select<Asset[]>(
        'SELECT * FROM assets WHERE id = $1',
        [assetId]
    );
    
    return rows.length > 0 ? rows[0] : null;
}

/**
 * Get all assets for a page
 */
export async function getPageAssets(pageId: string): Promise<Asset[]> {
    const db = await Database.load('sqlite:omni_workspace.db');
    return await db.select<Asset[]>(
        'SELECT * FROM assets WHERE page_id = $1 ORDER BY created_at DESC',
        [pageId]
    );
}

