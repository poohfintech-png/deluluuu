const fs = require('fs');

const file = 'src/pages/admin/AdminBooksPage.tsx';

fs.copyFileSync(file, file + '.backup');

let code = fs.readFileSync(file, 'utf8');

code = code.replace(
"import type { Book } from '@/types'",
"import type { Book, Genre } from '@/types'"
);

code = code.replace(
"import { Dialog,",
"import {\n  Select,\n  SelectContent,\n  SelectItem,\n  SelectTrigger,\n  SelectValue,\n} from '@/components/ui/select'\nimport { Dialog,"
);

code = code.replace(
"const [status, setStatus] = useState<'draft' | 'published'>(book?.status ?? 'draft')",
`const [status, setStatus] = useState<'draft' | 'published'>(book?.status ?? 'draft')
  const [genres, setGenres] = useState<Genre[]>([])
  const [genreId, setGenreId] = useState(book?.genre_id ?? '')`
);

code = code.replace(
"const fileInputRef = useRef<HTMLInputElement>(null)",
`const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchGenres = async () => {
      const { data } = await supabase
        .from('genres')
        .select('*')
        .is('deleted_at', null)
        .order('sort_order')

      if (data) setGenres(data as Genre[])
    }

    fetchGenres()
  }, [])`
);

code = code.replace(
"cover_url: coverUrl || null,\n      status,",
"cover_url: coverUrl || null,\n      genre_id: genreId || null,\n      status,"
);

code = code.replace(
`<div className="space-y-2">
            <Label>Cover Image</Label>`,
`<div className="space-y-2">
            <Label>Genre</Label>
            <Select value={genreId} onValueChange={setGenreId}>
              <SelectTrigger>
                <SelectValue placeholder="Select genre" />
              </SelectTrigger>
              <SelectContent>
                {genres.map((genre) => (
                  <SelectItem key={genre.id} value={genre.id}>
                    {genre.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cover Image</Label>`
);

fs.writeFileSync(file, code);

console.log('Genre patch completed');
