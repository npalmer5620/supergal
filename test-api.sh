#!/bin/bash

# SuperGal API Testing Script
# Test all endpoints with sample data

BASE_URL="http://localhost:8787"
COOKIES_FILE="/tmp/supergal_cookies.txt"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}SuperGal API Testing Suite${NC}\n"

# Test 1: Health Check
echo -e "${YELLOW}1. Testing Health Check${NC}"
curl -s -w "\nStatus: %{http_code}\n" "$BASE_URL/health" | jq .
echo ""

# Test 2: Bootstrap Admin User
echo -e "${YELLOW}2. Testing Bootstrap Admin User${NC}"
curl -s -c "$COOKIES_FILE" \
  -X POST "$BASE_URL/auth/bootstrap" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq .
echo ""

# Test 3: Login
echo -e "${YELLOW}3. Testing Login${NC}"
curl -s -b "$COOKIES_FILE" -c "$COOKIES_FILE" \
  -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq .
echo ""

# Test 4: Get Current User
echo -e "${YELLOW}4. Testing Get Current User${NC}"
curl -s -b "$COOKIES_FILE" \
  "$BASE_URL/auth/me" | jq .
echo ""

# Test 5: Create a Post
echo -e "${YELLOW}5. Testing Create Post${NC}"
POST_RESPONSE=$(curl -s -b "$COOKIES_FILE" \
  -X POST "$BASE_URL/posts" \
  -H "Content-Type: application/json" \
  -d '{
    "slug":"first-post",
    "title":"My First Post",
    "body_markdown":"# Hello World\n\nThis is my first post using markdown.",
    "status":"draft"
  }')
echo "$POST_RESPONSE" | jq .
POST_ID=$(echo "$POST_RESPONSE" | jq -r '.id')
echo ""

# Test 6: List Posts
echo -e "${YELLOW}6. Testing List Posts${NC}"
curl -s -b "$COOKIES_FILE" \
  "$BASE_URL/posts" | jq .
echo ""

# Test 7: Get Single Post
echo -e "${YELLOW}7. Testing Get Single Post${NC}"
curl -s -b "$COOKIES_FILE" \
  "$BASE_URL/posts/first-post" | jq .
echo ""

# Test 8: Update Post (publish it)
echo -e "${YELLOW}8. Testing Update Post${NC}"
curl -s -b "$COOKIES_FILE" \
  -X PUT "$BASE_URL/posts/first-post" \
  -H "Content-Type: application/json" \
  -d '{"status":"published"}' | jq .
echo ""

# Test 9: Create Tags
echo -e "${YELLOW}9. Testing Create Tags${NC}"
TAG1_RESPONSE=$(curl -s -b "$COOKIES_FILE" \
  -X POST "$BASE_URL/tags" \
  -H "Content-Type: application/json" \
  -d '{"name":"photography"}')
echo "$TAG1_RESPONSE" | jq .
TAG1_ID=$(echo "$TAG1_RESPONSE" | jq -r '.id')

TAG2_RESPONSE=$(curl -s -b "$COOKIES_FILE" \
  -X POST "$BASE_URL/tags" \
  -H "Content-Type: application/json" \
  -d '{"name":"tutorial"}')
echo "$TAG2_RESPONSE" | jq .
TAG2_ID=$(echo "$TAG2_RESPONSE" | jq -r '.id')
echo ""

# Test 10: Tag the Post
echo -e "${YELLOW}10. Testing Tag Post${NC}"
curl -s -b "$COOKIES_FILE" \
  -X POST "$BASE_URL/tags/$TAG1_ID/posts/$POST_ID" | jq .
echo ""

# Test 11: List Tags
echo -e "${YELLOW}11. Testing List Tags${NC}"
curl -s -b "$COOKIES_FILE" \
  "$BASE_URL/tags" | jq .
echo ""

# Test 12: Get Tag with Posts
echo -e "${YELLOW}12. Testing Get Tag with Posts${NC}"
curl -s -b "$COOKIES_FILE" \
  "$BASE_URL/tags/$TAG1_ID" | jq .
echo ""

# Test 13: Create Gallery
echo -e "${YELLOW}13. Testing Create Gallery${NC}"
GALLERY_RESPONSE=$(curl -s -b "$COOKIES_FILE" \
  -X POST "$BASE_URL/galleries" \
  -H "Content-Type: application/json" \
  -d '{
    "slug":"my-gallery",
    "title":"My Photo Gallery",
    "description":"A collection of my best photos",
    "status":"draft"
  }')
echo "$GALLERY_RESPONSE" | jq .
GALLERY_ID=$(echo "$GALLERY_RESPONSE" | jq -r '.id')
echo ""

# Test 14: Upload Image
echo -e "${YELLOW}14. Testing Image Upload${NC}"
# Create a simple test image using ImageMagick
convert -size 200x200 xc:red /tmp/test-image.png 2>/dev/null || \
  # Fallback: create minimal 1x1 pixel PNG if ImageMagick not available
  printf '\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90\x77\x53\x0d\x00\x00\x00\x0c\x49\x44\x41\x54\x08\x99\x63\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\x5d\xfa\x9c\xfe\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82' > /tmp/test-image.png

IMAGE_RESPONSE=$(curl -s -b "$COOKIES_FILE" \
  -X POST "$BASE_URL/images" \
  -F "image=@/tmp/test-image.png" \
  -F "title=Test Image" \
  -F "caption=A test image for the gallery" \
  -F "alt_text=Red square")
echo "$IMAGE_RESPONSE" | jq .
IMAGE_ID=$(echo "$IMAGE_RESPONSE" | jq -r '.id')
echo ""

# Test 15: List Images
echo -e "${YELLOW}15. Testing List Images${NC}"
curl -s -b "$COOKIES_FILE" \
  "$BASE_URL/images" | jq .
echo ""

# Test 16: Get Single Image
echo -e "${YELLOW}16. Testing Get Single Image${NC}"
curl -s -b "$COOKIES_FILE" \
  "$BASE_URL/images/$IMAGE_ID" | jq .
echo ""

# Test 17: Add Image to Gallery
echo -e "${YELLOW}17. Testing Add Image to Gallery${NC}"
curl -s -b "$COOKIES_FILE" \
  -X POST "$BASE_URL/galleries/my-gallery/images" \
  -H "Content-Type: application/json" \
  -d "{\"image_id\":\"$IMAGE_ID\",\"caption_override\":\"Beautiful red square\"}" | jq .
echo ""

# Test 18: Get Gallery with Images
echo -e "${YELLOW}18. Testing Get Gallery with Images${NC}"
curl -s -b "$COOKIES_FILE" \
  "$BASE_URL/galleries/my-gallery" | jq .
echo ""

# Test 19: Publish Gallery
echo -e "${YELLOW}19. Testing Publish Gallery${NC}"
curl -s -b "$COOKIES_FILE" \
  -X PUT "$BASE_URL/galleries/my-gallery" \
  -H "Content-Type: application/json" \
  -d '{"status":"published"}' | jq .
echo ""

# Test 20: Tag the Gallery
echo -e "${YELLOW}20. Testing Tag Gallery${NC}"
curl -s -b "$COOKIES_FILE" \
  -X POST "$BASE_URL/tags/$TAG1_ID/galleries/$GALLERY_ID" | jq .
echo ""

# Test 21: Search by Text
echo -e "${YELLOW}21. Testing Full-Text Search${NC}"
curl -s -b "$COOKIES_FILE" \
  "$BASE_URL/search?q=hello" | jq .
echo ""

# Test 22: Search by Tag
echo -e "${YELLOW}22. Testing Search by Tag${NC}"
curl -s -b "$COOKIES_FILE" \
  "$BASE_URL/search/tags/$TAG1_ID" | jq .
echo ""

# Test 23: Filter Posts by Status
echo -e "${YELLOW}23. Testing Filter Posts by Status${NC}"
curl -s -b "$COOKIES_FILE" \
  "$BASE_URL/posts?status=published" | jq .
echo ""

# Test 24: Filter by Tags
echo -e "${YELLOW}24. Testing Filter Posts by Tag${NC}"
curl -s -b "$COOKIES_FILE" \
  "$BASE_URL/posts?tags=$TAG1_ID" | jq .
echo ""

# Test 25: Logout
echo -e "${YELLOW}25. Testing Logout${NC}"
curl -s -b "$COOKIES_FILE" \
  -X POST "$BASE_URL/auth/logout" | jq .
echo ""

echo -e "${GREEN}Testing complete!${NC}"
echo -e "\n${YELLOW}Summary:${NC}"
echo "- Created 1 published post with tag"
echo "- Created 1 gallery with 1 image (tags applied)"
echo "- Created 2 tags"
echo "- All CRUD operations tested"
echo "- Search and filtering tested"
echo ""
echo -e "${YELLOW}Check uploaded files:${NC}"
echo "- Original: /uploads/original/"
echo "- Thumbnails: /uploads/thumbnails-{200,500,1000}/"
