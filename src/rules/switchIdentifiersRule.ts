import {Rules, RuleFailure, ProgramAwareRuleWalker} from 'tslint';
import * as ts from 'typescript';
import {getOriginalSymbolFromIdentifier} from '../typescript/identifiers';
import {isExportSpecifierNode, isImportSpecifierNode} from '../typescript/imports';
import {
  isMaterialImportDeclaration,
  isMaterialExportDeclaration,
} from '../material/typescript-specifiers';
import {classNames} from '../material/component-data';

/** Message that is being sent to TSLint if an identifier still uses the outdated prefix. */
const failureMessage = 'Identifier can be switched from "Md" prefix to "Mat".';

/**
 * Rule that walks through every identifier that is part of Angular Material and replaces the
 * outdated prefix with the new one.
 */
export class Rule extends Rules.TypedRule {

  applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): RuleFailure[] {
    return this.applyWithWalker(
        new SwitchIdentifiersWalker(sourceFile, this.getOptions(), program));
  }
}

export class SwitchIdentifiersWalker extends ProgramAwareRuleWalker {

  /** List of Angular Material declarations inside of the current source file. */
  materialDeclarations: ts.Declaration[] = [];

  /** Method that is called for every identifier inside of the specified project. */
  visitIdentifier(identifier: ts.Identifier) {
    // For identifiers that aren't listed in the className data, the whole check can be
    // skipped safely.
    if (!classNames.some(data => data.md === identifier.text)) {
      return;
    }

    const originalSymbol = getOriginalSymbolFromIdentifier(identifier, this.getTypeChecker());

    // For export declarations that are referring to Angular Material, the identifier should be
    // switched to the new prefix.
    if (isExportSpecifierNode(identifier) && isMaterialExportDeclaration(identifier)) {
      return this.createIdentifierFailure(identifier, originalSymbol);
    }

    // For import declarations that are referring to Angular Material, the value declarations
    // should be stored so that other identifiers in the file can be compared.
    if (isImportSpecifierNode(identifier) && isMaterialImportDeclaration(identifier)) {
      this.materialDeclarations.push(originalSymbol.valueDeclaration);
    }

    // For identifiers that are not part of an import or export, the list of Material declarations
    // should be checked to ensure that only identifiers of Angular Material are updated.
    else if (this.materialDeclarations.indexOf(originalSymbol.valueDeclaration) === -1) {
      return;
    }

    return this.createIdentifierFailure(identifier, originalSymbol);
  }

  /** Creates a failure and replacement for the specified identifier. */
  private createIdentifierFailure(identifier: ts.Identifier, symbol: ts.Symbol) {
    console.log('Identifier', identifier);
    console.log('Symbol', symbol)
    const newClassName = classNames.find(data => data.md === symbol.name).mat;
    const replacement = this.createReplacement(
        identifier.getStart(), identifier.getWidth(), newClassName);

    this.addFailureAtNode(identifier, failureMessage, replacement);
  }
}
