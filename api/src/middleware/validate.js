// Validation helpers
const validators = {
    slug: (val) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(val) && val.length >= 3,
    title: (val) => val && val.length >= 3 && val.length <= 500,
    email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    username: (val) => /^[a-zA-Z0-9_-]{3,20}$/.test(val),
    password: (val) => val && val.length >= 8,
    markdown: (val) => val && val.length >= 0,
    status: (val) => ["draft", "published", "archived"].includes(val),
    tags: (val) => Array.isArray(val) && val.every(tag => typeof tag === "string" && tag.length > 0),
};

export function validate(schema) {
    return (req, res, next) => {
        const errors = {};

        for (const [field, rules] of Object.entries(schema)) {
            const value = req.body[field];

            if (rules.required && !value) {
                errors[field] = "required";
                continue;
            }

            if (value && rules.type) {
                if (rules.type === "string" && typeof value !== "string") {
                    errors[field] = "must_be_string";
                    continue;
                }
                if (rules.type === "array" && !Array.isArray(value)) {
                    errors[field] = "must_be_array";
                    continue;
                }
            }

            if (value && rules.validator && !validators[rules.validator](value)) {
                errors[field] = `invalid_${rules.validator}`;
                continue;
            }

            if (value && rules.maxLength && value.length > rules.maxLength) {
                errors[field] = "too_long";
                continue;
            }

            if (value && rules.minLength && value.length < rules.minLength) {
                errors[field] = "too_short";
                continue;
            }
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ error: "validation_error", details: errors });
        }

        next();
    };
}

export const schemas = {
    postCreate: {
        slug: { required: true, type: "string", validator: "slug" },
        title: { required: true, type: "string", validator: "title" },
        body_markdown: { required: true, type: "string", validator: "markdown" },
        status: { type: "string", validator: "status" },
    },
    postUpdate: {
        title: { type: "string", validator: "title" },
        body_markdown: { type: "string", validator: "markdown" },
        status: { type: "string", validator: "status" },
        slug: { type: "string", validator: "slug" },
    },
    galleryCreate: {
        slug: { required: true, type: "string", validator: "slug" },
        title: { required: true, type: "string", validator: "title" },
        description: { type: "string", maxLength: 1000 },
        status: { type: "string", validator: "status" },
    },
    galleryUpdate: {
        title: { type: "string", validator: "title" },
        description: { type: "string", maxLength: 1000 },
        status: { type: "string", validator: "status" },
        slug: { type: "string", validator: "slug" },
    },
    tagCreate: {
        name: { required: true, type: "string", minLength: 2, maxLength: 50 },
    },
    authLogin: {
        username: { required: true, type: "string", validator: "username" },
        password: { required: true, type: "string", validator: "password" },
    },
    authRegister: {
        username: { required: true, type: "string", validator: "username" },
        password: { required: true, type: "string", validator: "password" },
        email: { type: "string", validator: "email" },
    },
};
