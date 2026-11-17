export type LyricLine = { at: number; original: string; translation: string };
export type Song = { id: string; title: string; artist: string; album: string; duration: number; accent: string; lines: LyricLine[] };
export const songs: Song[] = [
  { id: 'horizonte', title: 'Depois do Horizonte', artist: 'LyraFlow Sessions', album: 'Noites em Movimento', duration: 222, accent: '#d1a164', lines: [
    { at: 0, original: 'The city fades beneath the rain', translation: 'A cidade desaparece sob a chuva' },
    { at: 18, original: 'I hear the echoes call my name', translation: 'Ouço os ecos chamarem meu nome' },
    { at: 37, original: 'A little light across the blue', translation: 'Uma pequena luz atravessa o azul' },
    { at: 57, original: 'It leads me somewhere close to you', translation: 'Ela me leva para perto de você' },
    { at: 78, original: 'And when the quiet starts to grow', translation: 'E quando o silêncio começa a crescer' },
    { at: 99, original: 'We find a road we used to know', translation: 'Encontramos uma estrada que conhecíamos' },
    { at: 122, original: 'Beyond the edge of fading stars', translation: 'Além do limite das estrelas que se apagam' },
    { at: 146, original: 'The night is ours, the night is ours', translation: 'A noite é nossa, a noite é nossa' },
    { at: 172, original: 'So let the morning wait for us', translation: 'Então deixe a manhã esperar por nós' },
    { at: 199, original: 'Until the sky begins to blush', translation: 'Até que o céu comece a corar' }
  ] },
  { id: 'mare', title: 'Maré de Dentro', artist: 'LyraFlow Sessions', album: 'Entre Luzes', duration: 195, accent: '#6db7b4', lines: [
    { at: 0, original: 'I found a rhythm in the tide', translation: 'Encontrei um ritmo na maré' },
    { at: 20, original: 'A softer place where thoughts can hide', translation: 'Um lugar mais calmo onde os pensamentos repousam' },
    { at: 42, original: 'The silver water meets the shore', translation: 'A água prateada encontra a praia' },
    { at: 65, original: 'And I can breathe a little more', translation: 'E consigo respirar um pouco melhor' },
    { at: 90, original: 'Let every passing moment flow', translation: 'Deixe cada momento passar' },
    { at: 118, original: 'There is no need to rush below', translation: 'Não há motivo para correr' },
    { at: 150, original: 'I carry calm beneath my skin', translation: 'Carrego calma dentro de mim' }
  ] }
];
export const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
