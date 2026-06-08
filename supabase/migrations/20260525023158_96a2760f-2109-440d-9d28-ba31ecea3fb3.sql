
CREATE TABLE public.keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read keywords"
  ON public.keywords FOR SELECT
  USING (true);

INSERT INTO public.keywords (word) VALUES
  ('crypto'),('payment'),('instagram'),('linkedin'),('facebook'),('negative'),
  ('star'),('transferwise'),('account'),('bank'),('messenger'),('skype'),
  ('card'),('credit'),('purchase'),('whatsapp'),('password'),('inbox'),
  ('sms'),('transaction'),('stripe'),('paypal'),('rating'),('rate'),
  ('review'),('euro'),('dollar'),('money'),('pay'),('outside'),('contact'),
  ('email'),('gmail'),('mail'),('@')
ON CONFLICT (word) DO NOTHING;
