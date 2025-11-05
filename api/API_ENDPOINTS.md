# SuperGal API Endpoints

## Authentication Routes (`/auth`)

### POST /auth/bootstrap
Initial admin user registration (first user only).
```json
{
  "username": "admin",
  "password": "securepassword123"
}
```

### POST /auth/login
User login, returns JWT tokens in httpOnly cookies.
```json
{
  "username": "admin",
  "password": "securepassword123"
}
```
Response: `{ "ok": true }` (tokens in cookies)

### POST /auth/refresh
Refresh access token using refresh token from cookies.
Response: `{ "ok": true }` (new access token in cookie)

### POST /auth/logout
Revoke refresh token.
Response: `{ "ok": true }`

### GET /auth/me
Get current authenticated user info.
Response: `{ "id": "...", "username": "...", "is_admin": 1 }`

---

## Posts Routes (`/posts`)

### GET /posts
List all posts with optional filtering.
Query parameters:
- `status` - comma-separated: draft, published, archived
- `tags` - comma-separated tag IDs to filter by

Response: `[{ "id", "slug", "title", "status", "created_at" }]`

### GET /posts/:slug
Get single post with full content.
Response: `{ "id", "slug", "title", "body_markdown", "body_html", "status", "author_id", "featured_image_id", "created_at", "updated_at", "published_at" }`

### POST /posts (requires auth)
Create new post.
```json
{
  "slug": "my-post",
  "title": "My Blog Post",
  "body_markdown": "# Markdown content here",
  "status": "draft"  // optional: draft (default), published, archived
}
```
Response: `{ "ok": true, "id": "...", "slug": "..." }`

### PUT /posts/:slug (requires auth)
Update post.
```json
{
  "title": "Updated Title",
  "body_markdown": "Updated markdown",
  "status": "published"
}
```
Response: `{ "ok": true }`

### DELETE /posts/:slug (requires auth)
Delete post.
Response: `{ "ok": true }`

---

## Images Routes (`/images`)

### GET /images
List all images with metadata and thumbnail URLs.
Response:
```json
[{
  "id": "...",
  "file_path": "original/...",
  "title": "...",
  "mime_type": "image/jpeg",
  "width": 1920,
  "height": 1080,
  "file_size": 123456,
  "caption": "...",
  "alt_text": "...",
  "created_at": "...",
  "thumbnails": {
    "small": "/uploads/thumbnails-200/...",
    "medium": "/uploads/thumbnails-500/...",
    "large": "/uploads/thumbnails-1000/..."
  }
}]
```

### GET /images/:id
Get single image details with hash and all thumbnail URLs.
Response:
```json
{
  "id": "...",
  "file_path": "original/...",
  "title": "...",
  "mime_type": "image/jpeg",
  "width": 1920,
  "height": 1080,
  "file_size": 123456,
  "caption": "...",
  "alt_text": "...",
  "sha256": "abc123...",
  "created_at": "...",
  "original": "/uploads/original/...",
  "thumbnails": {
    "small": "/uploads/thumbnails-200/...",
    "medium": "/uploads/thumbnails-500/...",
    "large": "/uploads/thumbnails-1000/..."
  }
}
```

### POST /images (requires auth)
Upload image with automatic dimension detection and thumbnail generation.

**Features:**
- Automatically detects image dimensions (width × height)
- Generates three thumbnail sizes: 200px, 500px, 1000px (contain fit, aspect-ratio preserved)
- Calculates SHA256 hash for deduplication
- Stores all metadata in database

Form data (multipart):
- `image` - image file (required)
- `title` - optional image title
- `caption` - optional caption/credit
- `alt_text` - optional alt text for accessibility

Response:
```json
{
  "ok": true,
  "id": "image-uuid",
  "path": "/uploads/original/image-uuid.jpg",
  "mime_type": "image/jpeg",
  "file_size": 123456,
  "sha256": "abc123...",
  "width": 1920,
  "height": 1080,
  "thumbnails": {
    "small": "/uploads/thumbnails-200/image-uuid.jpg",
    "medium": "/uploads/thumbnails-500/image-uuid.jpg",
    "large": "/uploads/thumbnails-1000/image-uuid.jpg"
  }
}
```

---

## Galleries Routes (`/galleries`)

### GET /galleries
List all galleries with optional filtering.
Query parameters:
- `status` - comma-separated: draft, published, archived
- `tags` - comma-separated tag IDs to filter by

Response: `[{ "id", "slug", "title", "description", "status", "created_at", "updated_at" }]`

### GET /galleries/:slug
Get single gallery with all images.
Response:
```json
{
  "id": "...",
  "slug": "...",
  "title": "...",
  "description": "...",
  "status": "...",
  "author_id": "...",
  "created_at": "...",
  "updated_at": "...",
  "published_at": "...",
  "images": [
    {
      "id": "...",
      "file_path": "...",
      "title": "...",
      "caption_override": "...",
      "position": 1
    }
  ]
}
```

### POST /galleries (requires auth)
Create gallery.
```json
{
  "slug": "my-gallery",
  "title": "My Gallery",
  "description": "Optional description",
  "status": "draft"  // optional: draft, published, archived
}
```
Response: `{ "ok": true, "id": "...", "slug": "..." }`

### PUT /galleries/:slug (requires auth)
Update gallery.
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "status": "published"
}
```
Response: `{ "ok": true }`

### DELETE /galleries/:slug (requires auth)
Delete gallery (cascades to gallery_images).
Response: `{ "ok": true }`

### POST /galleries/:slug/images (requires auth)
Add image to gallery.
```json
{
  "image_id": "image-uuid",
  "caption_override": "Optional per-gallery caption"
}
```
Response: `{ "ok": true, "position": 1 }`

### DELETE /galleries/:slug/images/:image_id (requires auth)
Remove image from gallery (reorders remaining images).
Response: `{ "ok": true }`

---

## Tags Routes (`/tags`)

### GET /tags
List all tags with usage counts.
Response: `[{ "id": "...", "name": "...", "count": 5 }]`

### GET /tags/:id
Get single tag with tagged posts and galleries.
Response:
```json
{
  "id": "...",
  "name": "...",
  "posts": [
    { "id": "...", "slug": "...", "title": "...", "status": "..." }
  ],
  "galleries": [
    { "id": "...", "slug": "...", "title": "...", "status": "..." }
  ]
}
```

### POST /tags (requires auth)
Create tag.
```json
{
  "name": "photography"
}
```
Response: `{ "ok": true, "id": "...", "name": "..." }`

### PUT /tags/:id (requires auth)
Update tag name.
```json
{
  "name": "new-tag-name"
}
```
Response: `{ "ok": true }`

### DELETE /tags/:id (requires auth)
Delete tag (cascades to taggings).
Response: `{ "ok": true }`

### POST /tags/:id/posts/:post_id (requires auth)
Add tag to post.
Response: `{ "ok": true }`

### DELETE /tags/:id/posts/:post_id (requires auth)
Remove tag from post.
Response: `{ "ok": true }`

### POST /tags/:id/galleries/:gallery_id (requires auth)
Add tag to gallery.
Response: `{ "ok": true }`

### DELETE /tags/:id/galleries/:gallery_id (requires auth)
Remove tag from gallery.
Response: `{ "ok": true }`

---

## Search Routes (`/search`)

### GET /search?q=query&type=posts|galleries|images|all
Full-text search across posts/galleries/images.
Query parameters:
- `q` - search query (required)
- `type` - optional: posts, galleries, images, or all (default: all)

Response:
```json
{
  "query": "...",
  "total": 5,
  "results": {
    "posts": [
      { "id": "...", "slug": "...", "title": "...", "status": "...", "created_at": "...", "relevance": 95 }
    ],
    "galleries": [...],
    "images": [...]
  }
}
```

### GET /search/tags/:tag_id
Get all posts and galleries with specific tag.
Response:
```json
{
  "tag": { "id": "...", "name": "..." },
  "posts": [...],
  "galleries": [...]
}
```

---

## Error Responses

All endpoints return error responses in this format:
```json
{
  "error": "error_code",
  "message": "optional error message",
  "details": { "field": "error_reason" }  // for validation errors
}
```

Common error codes:
- `missing_fields` - required fields missing
- `validation_error` - input validation failed
- `not_found` - resource not found
- `unauthorized` - authentication required
- `bad_credentials` - login failed
- `user_exists` - user already registered
- `tag_already_exists` - tag name not unique
- `upload_failed` - file upload error

---

## Status Codes

- `200` - OK
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Server Error

---

## Authentication

All protected routes require one of:
1. `Authorization: Bearer <token>` header
2. `access` cookie with JWT token

Tokens are set as httpOnly cookies by login/refresh endpoints.

---

## Image Processing

### Automatic Thumbnail Generation

When images are uploaded via `POST /images`, the system automatically:

1. **Detects dimensions** - Extracts width and height from image metadata
2. **Generates thumbnails** - Creates three optimized sizes:
   - `200px` - `/uploads/thumbnails-200/` - For thumbnails in lists/galleries
   - `500px` - `/uploads/thumbnails-500/` - For medium previews
   - `1000px` - `/uploads/thumbnails-1000/` - For detail views

3. **Preserves aspect ratio** - All thumbnails use "contain" fitting with white background
4. **Supports all formats** - JPEG, PNG, WebP, TIFF, GIF, etc.

### Upload Directory Structure

```
uploads/
├── original/           # Full-size images as uploaded
├── thumbnails-200/     # 200x200px thumbnails
├── thumbnails-500/     # 500x500px thumbnails
└── thumbnails-1000/    # 1000x1000px thumbnails
```

### Accessing Images

- **Original**: `/uploads/original/{filename}`
- **Small thumbnail**: `/uploads/thumbnails-200/{filename}`
- **Medium thumbnail**: `/uploads/thumbnails-500/{filename}`
- **Large thumbnail**: `/uploads/thumbnails-1000/{filename}`

URLs are returned in all image responses under the `thumbnails` object.

### Image Deduplication

All uploaded images are hashed with SHA256. The hash is returned in the upload response and stored in the database, allowing clients to:
- Detect duplicate uploads (same SHA256)
- Implement smart caching strategies
- Verify image integrity

---

## Environment Variables

Configure via `.env` file or environment:
- `PORT` - API port (default: 8787)
- `DB_PATH` - SQLite database path (default: ./data/app.db)
- `UPLOAD_DIR` - Upload directory (default: ./uploads)
- `SESSION_SECRET` - Session signing secret
- `JWT_SECRET` - JWT signing secret (default: dev-secret)
- `ALLOWED_ORIGINS` - CORS allowed origins, comma-separated (default: *)
- `NODE_ENV` - Environment (production, development)
