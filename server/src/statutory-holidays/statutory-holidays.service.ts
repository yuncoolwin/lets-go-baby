import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'

@Injectable()
export class StatutoryHolidaysService {
  async findAll(year?: number) {
    const supabase = getSupabaseClient()
    let query = supabase.from('holidays_old').select('*').order('date', { ascending: true })
    if (year) {
      query = query.eq('year', year)
    }
    const { data, error } = await query
    if (error) {
      console.error('[StatutoryHolidays] findAll error:', error)
      throw new Error(error.message)
    }
    return { data: data || [] }
  }

  async getYears() {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('holidays_old')
      .select('year')
      .order('year', { ascending: false })
    if (error) {
      console.error('[StatutoryHolidays] getYears error:', error)
      throw new Error(error.message)
    }
    const years = [...new Set((data || []).map((r: any) => r.year))]
    return { data: years }
  }
}