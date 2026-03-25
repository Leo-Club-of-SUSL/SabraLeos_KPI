import { supabase } from '../lib/supabase';

export interface SystemLog {
    user_id?: string;
    user_name?: string;
    action: string;
    details?: any;
    entity_type?: string;
    entity_id?: string;
}

export const logService = {
    async log(entry: SystemLog) {
        try {
            const { error } = await supabase
                .from('system_logs')
                .insert({
                    user_id: entry.user_id,
                    user_name: entry.user_name,
                    action: entry.action,
                    details: entry.details,
                    entity_type: entry.entity_type,
                    entity_id: entry.entity_id
                } as any);
            
            if (error) console.error('Logging failed:', error);
        } catch (err) {
            console.error('Error writing log:', err);
        }
    },

    async getLogs() {
        const { data, error } = await supabase
            .from('system_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        return data || [];
    }
};
