export interface paths {
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/model-info": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Model Info */
        get: operations["model_info_api_model_info_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Options */
        get: operations["options_api_options_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cpi-reference": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cpi Reference */
        get: operations["cpi_reference_api_cpi_reference_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/predict": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Predict */
        post: operations["predict_api_predict_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** CpiSelection */
        CpiSelection: {
            /**
             * Mode
             * @default auto
             * @enum {string}
             */
            mode: "auto" | "manual";
            /** Score */
            score?: number | null;
            /** Reference Year */
            reference_year?: number | null;
            /** Source */
            source?: string | null;
        };
        /** Estimates */
        Estimates: {
            /** Success Probability */
            success_probability: number;
            /** Expected Cost Change Ratio */
            expected_cost_change_ratio: number;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** ModelInfo */
        ModelInfo: {
            /**
             * Mode
             * @enum {string}
             */
            mode: "demo" | "model" | "unavailable";
            /** Version */
            version: string | null;
            /** Ready */
            ready: boolean;
            /** Limitations */
            limitations: string[];
            /** Metrics */
            metrics?: {
                [key: string]: number;
            };
            /** Training Year Min */
            training_year_min?: number | null;
            /** Training Year Max */
            training_year_max?: number | null;
        };
        /** Options */
        Options: {
            /** Countries */
            countries: string[];
            /** Sectors */
            sectors: {
                [key: string]: string;
            };
        };
        /** Prediction */
        Prediction: {
            /**
             * Mode
             * @enum {string}
             */
            mode: "demo" | "model";
            /** Model Version */
            model_version: string;
            cpi: components["schemas"]["CpiSelection"];
            estimates: components["schemas"]["Estimates"];
            /** Expected Cost Change Usd */
            expected_cost_change_usd: number;
            /** Notes */
            notes: components["schemas"]["ReviewNote"][];
            /** Limitations */
            limitations: string[];
        };
        /** ProjectInput */
        ProjectInput: {
            /**
             * Country
             * @enum {string}
             */
            country: "Colombia" | "Federated States of Micronesia" | "France" | "Germany" | "India" | "Japan" | "Kenya" | "Lithuania" | "Nigeria" | "Philippines" | "United Kingdom" | "United States";
            /**
             * Sector Code
             * @enum {integer}
             */
            sector_code: 12191 | 12220 | 12230 | 12264 | 15122 | 15123;
            /** Initial Budget Usd */
            initial_budget_usd: number;
            /** Cpi Score */
            cpi_score?: number | null;
            /**
             * Cpi Mode
             * @default auto
             * @enum {string}
             */
            cpi_mode: "auto" | "manual";
            /** Approval Month */
            approval_month: number;
            /** Approval Year */
            approval_year: number;
        };
        /** ReviewNote */
        ReviewNote: {
            /** Code */
            code: string;
            /** Title */
            title: string;
            /** Detail */
            detail: string;
        };
        /** ValidationError */
        ValidationError: {
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
            /** Input */
            input?: unknown;
            /** Context */
            ctx?: Record<string, never>;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    health_api_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
        };
    };
    model_info_api_model_info_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ModelInfo"];
                };
            };
        };
    };
    options_api_options_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Options"];
                };
            };
        };
    };
    cpi_reference_api_cpi_reference_get: {
        parameters: {
            query: {
                country: "Colombia" | "Federated States of Micronesia" | "France" | "Germany" | "India" | "Japan" | "Kenya" | "Lithuania" | "Nigeria" | "Philippines" | "United Kingdom" | "United States";
                approval_year: number;
                approval_month: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CpiSelection"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    predict_api_predict_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProjectInput"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Prediction"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}
