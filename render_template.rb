require 'liquid'

Liquid::Template.file_system = Liquid::LocalFileSystem.new(".", "%s.html")

$stdout.write(Liquid::Template.parse($stdin.read).render({
    'root' => '/',
    'host' => 'https://www.simon816.com',
    'assets' => '/assets/',
    'files' => '/files/',
}))
