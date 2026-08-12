import mongoose, { Schema, Document } from 'mongoose';

export type AnalyticsEventType =
  | 'page_view'
  | 'quote_started'
  | 'quote_priced'
  | 'quote_abandoned'
  | 'quote_ordered'
  | 'explore_model_opened'
  | 'modeling_request_submitted'
  | 'contact_form_submitted';

export interface IAnalyticsEvent extends Document {
  eventType: AnalyticsEventType;
  sessionId: string;
  page?: string;
  language?: string;
  payload?: Record<string, any>;
  createdAt: Date;
}

const AnalyticsEventSchema: Schema = new Schema({
  eventType: {
    type: String,
    required: true,
    enum: [
      'page_view',
      'quote_started',
      'quote_priced',
      'quote_abandoned',
      'quote_ordered',
      'explore_model_opened',
      'modeling_request_submitted',
      'contact_form_submitted'
    ],
    index: true
  },
  sessionId: { type: String, required: true, index: true },
  page: { type: String, default: '' },
  language: { type: String, default: 'en' },
  payload: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true }
});

export default mongoose.model<IAnalyticsEvent>('AnalyticsEvent', AnalyticsEventSchema);
