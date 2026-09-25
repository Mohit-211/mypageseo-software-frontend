#!/usr/bin/env perl
# TanStack Router -> React Router codemod.
#
# Usage:  perl scripts/tanstack-to-rr.pl src/path/a.tsx src/path/b.tsx ...
# Edits files in place (whole-file mode, so multi-line JSX props work).
# Always run the leftover grep afterwards; unusual shapes are left untouched.
#
# Handles:
#   import ... from "@tanstack/react-router"            -> "react-router-dom"
#   import type { LinkProps } / NonNullable<LinkProps["to"]>  -> removed / string
#   to="/a/$id/b" params={{ id }}          (any line breaks)  -> to={`/a/${id}/b`}
#   to="/a/$id" params={{ id: row.id }}                    -> to={`/a/${row.id}`}
#   to={item.to} params={{ id }}                           -> to={generatePath(item.to, { id })}
#                                                             (+ adds generatePath import)
#   "/a/$id/b" route-pattern string literals               -> "/a/:id/b"
#   navigate({ to: "/a/$id", params: { id: x } })          -> navigate(`/a/${x}`)
#   navigate({ to: "/a" })                                 -> navigate("/a")
use strict;
use warnings;

$^I = '';     # in-place edit, no backup
local $/;     # slurp whole file

sub build {
    my ( $path, $params ) = @_;
    my %map;
    for my $pair ( split /\s*,\s*/, $params ) {
        next unless length $pair;
        if    ( $pair =~ /^(\w+)\s*:\s*(.+?)\s*$/s ) { $map{$1} = $2 }
        elsif ( $pair =~ /^(\w+)$/ )               { $map{$1} = $1 }
    }
    ( my $out = $path ) =~ s/\$(\w+)/exists $map{$1} ? "\${$map{$1}}" : "\$$1"/ge;
    return "`$out`";
}

while ( my $src = <> ) {
    # Imports / types
    $src =~ s#from "\@tanstack/react-router"#from "react-router-dom"#g;
    $src =~ s#^import type \{ LinkProps \} from "react-router-dom";\n##mg;
    $src =~ s#, type LinkProps##g;
    $src =~ s#NonNullable<LinkProps\["to"\]>#string#g;

    # Static path + params (params may sit on the next line)
    $src =~ s#\bto="([^"]*)"\s+params=\{\{\s*([^{}]*?)\s*\}\}#"to={" . build($1, $2) . "}"#ge;

    # Dynamic path + params -> generatePath
    $src =~ s#\bto=\{([\w.]+)\}\s+params=\{\{\s*([^{}]*?)\s*\}\}#to={generatePath($1, { $2 })}#g;

    # navigate(...)
    $src =~ s#navigate\(\{\s*to:\s*"([^"]*)",\s*params:\s*\{\s*([^{}]*?)\s*\}\s*,?\s*\}\)#"navigate(" . build($1, $2) . ")"#ge;
    $src =~ s#navigate\(\{\s*to:\s*("[^"]*")\s*,?\s*\}\)#navigate($1)#g;

    # Remaining "/.../$param" literals are route patterns -> ":param"
    $src =~ s#"(/[^"\n]*\$\w[^"\n]*)"#my $p = $1; $p =~ s/\$(\w+)/:$1/g; "\"$p\""#ge;

    # Ensure generatePath is imported when used
    if ( $src =~ /\bgeneratePath\(/
        && $src !~ /import \{[^}]*\bgeneratePath\b[^}]*\} from "react-router-dom"/ )
    {
        $src =~ s#import \{([^}]*?)\s*\} from "react-router-dom";#import {$1, generatePath } from "react-router-dom";#;
    }

    print $src;
}