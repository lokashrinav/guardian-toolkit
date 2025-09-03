const webFeatures = require('web-features');

/**
 * Check if a web feature is safe to use based on Baseline data
 * @param {string} featureName - The name of the web feature to check
 * @returns {Object} - Feature safety information
 */
function checkFeature(featureName) {
    // Normalize feature name (lowercase, handle variations)
    const normalizedName = featureName.toLowerCase().trim();
    
    // Check if feature exists in web-features data
    const feature = webFeatures.features[normalizedName];
    
    if (!feature) {
        return {
            found: false,
            feature: normalizedName,
            message: `Feature "${featureName}" not found in web-features database`,
            suggestions: findSimilarFeatures(normalizedName)
        };
    }

    // Extract baseline information
    const status = feature.status;
    const baseline = status.baseline;
    
    // Determine safety level
    let safety = 'unknown';
    let recommendation = '';
    
    if (baseline === 'high') {
        safety = 'safe';
        recommendation = 'This feature has high baseline support and is safe to use in production.';
    } else if (baseline === 'low') {
        safety = 'caution';
        recommendation = 'This feature has low baseline support. Use with caution and consider fallbacks.';
    } else if (baseline === false || baseline === null) {
        safety = 'unsafe';
        recommendation = 'This feature does not have baseline support. Avoid using in production without extensive testing.';
    }

    return {
        found: true,
        feature: normalizedName,
        name: feature.name,
        description: feature.description,
        safety: safety,
        baseline: baseline,
        baselineLowDate: status.baseline_low_date,
        baselineHighDate: status.baseline_high_date,
        support: status.support,
        recommendation: recommendation,
        spec: feature.spec,
        group: feature.group
    };
}

/**
 * Find similar features for suggestions when a feature is not found
 * @param {string} searchTerm - The search term
 * @returns {Array} - Array of similar feature names
 */
function findSimilarFeatures(searchTerm) {
    const allFeatures = Object.keys(webFeatures.features);
    const suggestions = allFeatures
        .filter(name => name.includes(searchTerm) || searchTerm.includes(name))
        .slice(0, 5);
    
    return suggestions.length > 0 ? suggestions : [];
}

module.exports = { checkFeature, findSimilarFeatures };