/**
 * Forecasting Service - Database operations for forecast persistence
 * 
 * Handles:
 * - Saving forecast results to forecasting table
 * - Retrieving historical forecasts
 * - Calculating confidence levels from MAPE
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/appConfig';

let supabaseClient = null;

const getSupabaseClient = () => {
  if (!supabaseClient) {
    const { URL, ANON_KEY } = SUPABASE_CONFIG;
    supabaseClient = createClient(URL, ANON_KEY);
  }
  return supabaseClient;
};

/**
 * Determine confidence level based on MAPE (Mean Absolute Percentage Error)
 * @param {number} mape - MAPE percentage (0-100)
 * @returns {string} - 'high' | 'medium' | 'low'
 */
const calculateConfidenceLevel = (mape) => {
  if (mape <= 10) return 'high';      // MAPE ≤ 10% = excellent accuracy
  if (mape <= 20) return 'high';      // MAPE ≤ 20% = good accuracy
  if (mape <= 40) return 'medium';    // MAPE ≤ 40% = fair accuracy
  return 'low';                       // MAPE > 40% = low confidence
};

/**
 * Save forecast results to forecasting table
 * Automatically called when forecast is calculated
 * 
 * @param {Array} forecastItems - Array of forecast objects from mlEngine
 * @param {string} period - 'daily' | 'monthly' | 'yearly'
 * @param {number} mape - Model accuracy percentage
 * @returns {Promise<Object>} - { success: boolean, data: [], error: null|string }
 */
export const saveForecastBatch = async (forecastItems, period, mape) => {
  try {
    const supabase = getSupabaseClient();

    if (!supabase) {
      console.warn('[ForecastService] Supabase not available - forecast not persisted');
      return { success: false, error: 'Supabase unavailable' };
    }

    if (!forecastItems || forecastItems.length === 0) {
      console.warn('[ForecastService] No forecast items to save');
      return { success: true, data: [], message: 'Empty forecast' };
    }

    // Step 1: Get all inventory items to map item names to IDs
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('inventory')
      .select('id, name, category');

    if (inventoryError) {
      console.warn('[ForecastService] Failed to fetch inventory items:', inventoryError);
      return { success: false, error: 'Failed to fetch inventory mapping' };
    }

    // Create a map of inventory item names to IDs
    const inventoryMap = {};
    (inventoryData || []).forEach(inv => {
      if (inv.name) {
        inventoryMap[inv.name.toLowerCase()] = {
          id: inv.id,
          category: inv.category
        };
      }
    });

    // Step 2: Prepare forecast records for insertion
    const now = new Date();
    const forecastRecords = forecastItems.map(item => {
      const itemName = item.item || item.name || '';
      const inventoryMatch = inventoryMap[itemName.toLowerCase()];

      return {
        date: new Date().toISOString().split('T')[0],  // Today's date
        forecasting_timestamp: now.toISOString(),
        inventory_item_id: inventoryMatch?.id || null,  // Look up from inventory table
        inventory_item_name: itemName,
        category: inventoryMatch?.category || item.category || 'Unknown',
        inventory_demand_quantity: parseFloat(item.forecast || 0),
        inventory_safety_stock_quantity: parseFloat(item.safetyStock || 0),
        accuracy_percentage: parseFloat(mape || 0),
        confidence_level: calculateConfidenceLevel(mape),
        forecasting_period: period,
        algorithm_used: 'holt_winters',
        actual_quantity: null,  // Will be populated later when actual sales known
        forecast_error_percentage: null,
      };
    });

    // Filter out records with null inventory_item_id (items not found in inventory)
    const validRecords = forecastRecords.filter(record => {
      if (!record.inventory_item_id) {
        console.warn(`[ForecastService] Item "${record.inventory_item_name}" not found in inventory - skipping`);
        return false;
      }
      return true;
    });

    if (validRecords.length === 0) {
      console.warn('[ForecastService] No valid forecast items to save (all items not found in inventory)');
      return { success: false, error: 'No matching inventory items' };
    }

    // Step 3: Insert into forecasting table
    const { data, error } = await supabase
      .from('forecasting')
      .insert(validRecords)
      .select();

    if (error) {
      console.error('[ForecastService] Failed to save forecasts:', error);
      return { success: false, error: error.message };
    }

    console.log(`[ForecastService] ✅ Saved ${data.length} forecast records for ${period} period`);
    return { success: true, data };

  } catch (err) {
    console.error('[ForecastService] Unexpected error saving forecasts:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Get historical forecasts for a specific item and period
 * 
 * @param {string} itemId - Inventory item UUID
 * @param {string} period - 'daily' | 'monthly' | 'yearly' (optional)
 * @param {number} days - Number of days to look back (default: 30)
 * @returns {Promise<Array>} - Historical forecast records
 */
export const getHistoricalForecasts = async (itemId, period = null, days = 30) => {
  try {
    const supabase = getSupabaseClient();

    if (!supabase) {
      console.warn('[ForecastService] Supabase not available');
      return [];
    }

    let query = supabase
      .from('forecasting')
      .select('*')
      .eq('inventory_item_id', itemId)
      .gte('forecasting_timestamp', new Date(Date.now() - days * 86400000).toISOString())
      .order('forecasting_timestamp', { ascending: false });

    if (period) {
      query = query.eq('forecasting_period', period);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ForecastService] Failed to retrieve forecasts:', error);
      return [];
    }

    return data || [];

  } catch (err) {
    console.error('[ForecastService] Error retrieving forecasts:', err);
    return [];
  }
};

/**
 * Get all forecasts for a specific date
 * Useful for comparing forecasts across items on same day
 * 
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @returns {Promise<Array>} - All forecasts for that date
 */
export const getForecastsByDate = async (date) => {
  try {
    const supabase = getSupabaseClient();

    if (!supabase) return [];

    const { data, error } = await supabase
      .from('forecasting')
      .select('*')
      .eq('date', date)
      .order('inventory_item_name', { ascending: true });

    if (error) {
      console.error('[ForecastService] Failed to retrieve forecasts by date:', error);
      return [];
    }

    return data || [];

  } catch (err) {
    console.error('[ForecastService] Error retrieving forecasts by date:', err);
    return [];
  }
};

/**
 * Delete old forecasts (cleanup/archival)
 * Keep forecasts for last N days, delete older ones
 * 
 * @param {number} retentionDays - Days to keep (default: 90)
 * @returns {Promise<Object>} - { success, deletedCount }
 */
export const deleteLegacyForecasts = async (retentionDays = 90) => {
  try {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return { success: false, error: 'Supabase unavailable' };
    }

    const cutoffDate = new Date(Date.now() - retentionDays * 86400000).toISOString();

    const { data, error } = await supabase
      .from('forecasting')
      .delete()
      .lt('forecasting_timestamp', cutoffDate)
      .select();

    if (error) {
      console.error('[ForecastService] Failed to delete legacy forecasts:', error);
      return { success: false, error: error.message };
    }

    console.log(`[ForecastService] Deleted ${data.length} forecasts older than ${retentionDays} days`);
    return { success: true, deletedCount: data.length };

  } catch (err) {
    console.error('[ForecastService] Error deleting legacy forecasts:', err);
    return { success: false, error: err.message };
  }
};

export default {
  saveForecastBatch,
  getHistoricalForecasts,
  getForecastsByDate,
  deleteLegacyForecasts,
};
